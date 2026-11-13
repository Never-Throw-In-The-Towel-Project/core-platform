import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAnonHandle } from "@/lib/identity/preference";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import type { UserRole } from "@/types/database";

// NOT a "use server" module -- these are server-internal helpers, never exposed
// as callable server actions. provisionInvite does NO authorization of its own,
// so exposing it to the client would be an open "invite anyone at any role"
// hole. Its callers (invite.ts, companyAdmin.ts) do the auth + derive
// company_id/role from trusted sources, never from raw form input.

export const INVITE_MISCONFIGURED = "Invites aren't set up correctly yet. Please contact NTITT support.";

// auth-js (2.x) has no getUserByEmail, so revokePendingInvite finds the invitee
// by scanning the paginated admin user list. A revoke is a rare admin action,
// so a bounded scan is fine; the cap bounds outbound work on a large tenant.
const REVOKE_SCAN_PAGE_SIZE = 1000;
const REVOKE_SCAN_MAX_PAGES = 20;

/**
 * The invite callback URL. Null (not a throw) when NEXT_PUBLIC_SITE_URL is
 * unset/invalid, so a misconfigured deploy surfaces a friendly error instead of
 * crashing an invite action uncaught.
 */
export function buildInviteRedirect(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return null;
  try {
    return new URL("/auth/callback", base).toString();
  } catch {
    return null;
  }
}

/**
 * Friendly copy for the invite errors an admin can actually act on.
 *
 * Keyed off GoTrue's stable error `code` first (auth-js `ErrorCode`), with the
 * message text only as a fallback. The human message wording is NOT a contract:
 * GoTrue phrases a duplicate as "...has already been registered", which the old
 * message-only `/already registered/` match missed (the word "been" sits in the
 * middle), so a plain re-invite of an existing account surfaced the generic
 * "try again" — actively misleading, since the retry can never succeed. The code
 * is the documented, version-stable signal, so prefer it.
 */
export function inviteErrorMessage(message: string, code?: string): string {
  if (code === "email_exists" || code === "user_already_exists") {
    return "Someone with that email already has an account.";
  }
  // GoTrue throttles auth emails (the built-in mailer caps near ~2/hour; a real
  // ceiling is set in the dashboard). Bulk invites in one sitting hit this —
  // tell the admin to wait rather than leaving them staring at a generic error.
  if (code === "over_email_send_rate_limit") {
    return "Too many invite emails have gone out in a short time. Wait a minute, then try again.";
  }
  if (code === "email_address_invalid") {
    return "That email address doesn't look valid. Check it and try again.";
  }
  // Fallbacks for an error that reached us without a code (a network/transport
  // failure, or a non-API error). The duplicate match is broadened to also catch
  // GoTrue's "has already been registered" phrasing.
  if (/already\s+(been\s+)?registered|already exists/i.test(message)) {
    return "Someone with that email already has an account.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many invite emails have gone out in a short time. Wait a minute, then try again.";
  }
  return "Something went wrong sending the invite. Please try again.";
}

/**
 * Shared invite + profile-provisioning path used by every invite flow. Sends
 * the Supabase invite email and upserts the profiles row directly -- the
 * handle_new_user trigger can't be relied on to carry user_metadata onto the
 * same auth.users insert, so this is the source of truth for the (already
 * validated) values. Callers own authorization and MUST derive company_id +
 * role from trusted sources (the caller's own profile, or a fixed constant),
 * never from raw form input.
 */
export async function provisionInvite(params: {
  email: string;
  displayName: string;
  companyId: string;
  role: UserRole;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const redirectTo = buildInviteRedirect();
  if (!redirectTo) return { ok: false, message: INVITE_MISCONFIGURED };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    data: { company_id: params.companyId, role: params.role, display_name: params.displayName },
    redirectTo,
  });
  if (error || !data.user) {
    // Log the REAL cause so the failure is diagnosable in Vercel logs — the
    // admin-facing message is deliberately generic, but without this the actual
    // reason (an email-delivery failure via the Send Email hook → Brevo, a rate
    // limit, a misconfigured hook secret) was swallowed at every step of the
    // chain, which is exactly why this took a code read to diagnose. The invitee
    // email is PII, so it's left out — the admin knows which address they typed;
    // the cause is what's missing. Matches the log-the-real-error pattern used in
    // finishOnboarding / uploadNoticeImage.
    console.error("[provisionInvite] inviteUserByEmail failed", {
      role: params.role,
      code: error?.code ?? "no_user_returned",
      cause: error?.message ?? "no user returned",
    });
    return { ok: false, message: inviteErrorMessage(error?.message ?? "", error?.code) };
  }

  // Guard against clobbering an existing account (finding E-new-6). For a
  // genuinely new invite the handle_new_user trigger has just inserted a default
  // (employee / DIRECT / not-onboarded / no-consent) row, which is safe to fill
  // in below. But inviteUserByEmail ALSO "succeeds" for an email that already
  // belongs to a pending, unconfirmed invitee (or a self-signup member),
  // returning that existing user -- and re-provisioning would relocate/demote
  // them (e.g. a company-B hr_admin re-inviting a pending company-A hr_admin).
  // So only write when the row is still that untouched trigger default (or
  // absent); otherwise refuse WITHOUT deleting -- the existing account must not
  // be destroyed by a re-invite (unlike the genuine-new rollback below, which
  // deletes the user THIS call just created).
  const { data: existing } = await admin
    .from("profiles")
    .select("role, company_id, onboarding_completed, tc_agreed_at")
    .eq("id", data.user.id)
    .maybeSingle();
  const isUntouchedSelfSignup =
    !existing ||
    (existing.role === "employee" &&
      existing.company_id === DIRECT_COMPANY_ID &&
      existing.onboarding_completed === false &&
      existing.tc_agreed_at === null);
  if (!isUntouchedSelfSignup) {
    return { ok: false, message: "Someone with that email already has an account." };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      company_id: params.companyId,
      role: params.role,
      // The admin-typed name is the member's REAL name: store it as full_name
      // (the admin-visible identity) and give display_name a generated anon
      // handle, so an invited member who later appears anonymously never shows
      // their real name (finding A3). Self-service signup already does this.
      full_name: params.displayName,
      display_name: generateAnonHandle(data.user.id),
    },
    { onConflict: "id" }
  );
  if (profileError) {
    // Roll back the half-provisioned account. inviteUserByEmail already created
    // the auth.users row (and a default employee/DIRECT_COMPANY profile via the
    // handle_new_user trigger) and it rejects an already-registered email -- so
    // without this, no retry could ever finish provisioning, and the invitee
    // could accept the emailed link and sign in as a plain employee in NTITT
    // Direct (wrong role, wrong tenant), unfixable from any in-app flow.
    // Deleting the auth user invalidates that emailed link and lets the caller
    // retry cleanly. Best-effort: if the delete itself fails, still report the
    // original setup failure rather than throw.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return { ok: false, message: "Couldn't finish setting up the invite. Please try again." };
  }
  return { ok: true };
}

/**
 * Rescind a PENDING invite — one sent to the wrong address, or to someone who
 * left before accepting. Deleting the invitee's auth user invalidates the
 * emailed link and frees the email to be re-invited (the same mechanism the
 * rollback above relies on). Server-internal, like provisionInvite: callers own
 * authorization. `restrictToCompanyId` scopes an hr_admin to a pending EMPLOYEE
 * invite at their OWN company (exactly what they can create); pass null for an
 * ntitt_admin, who may revoke any pending invite.
 *
 * Hard safety rule: this NEVER deletes an account that has actually been used.
 * A genuine pending invite has never confirmed its email and never signed in;
 * anything else is a live account, and revoke refuses rather than destroy it.
 */
export async function revokePendingInvite(params: {
  email: string;
  restrictToCompanyId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email) return { ok: false, message: "Enter the email the invite was sent to." };

  const admin = createAdminClient();

  let target: { id: string; confirmed: boolean } | null = null;
  for (let page = 1; page <= REVOKE_SCAN_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: REVOKE_SCAN_PAGE_SIZE });
    if (error) return { ok: false, message: "Couldn't look up that invite. Please try again." };
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) {
      target = { id: match.id, confirmed: Boolean(match.email_confirmed_at || match.last_sign_in_at) };
      break;
    }
    if (users.length < REVOKE_SCAN_PAGE_SIZE) break;
  }

  if (!target) return { ok: false, message: "No pending invite found for that email." };

  // Already accepted (confirmed email or signed in at least once) => a live
  // account, not a pending invite. Refuse: revoke must never delete a real user.
  if (target.confirmed) {
    return { ok: false, message: "That person has already accepted their invite — it can't be revoked here." };
  }

  // hr_admin scope: only a pending employee invite at their own company.
  if (params.restrictToCompanyId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id, role")
      .eq("id", target.id)
      .maybeSingle();
    const p = profile as { company_id: string; role: string } | null;
    if (!p || p.company_id !== params.restrictToCompanyId || p.role !== "employee") {
      return { ok: false, message: "That invite isn't one you can revoke." };
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
  if (deleteError) return { ok: false, message: "Couldn't revoke that invite. Please try again." };
  return { ok: true };
}
