import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

// NOT a "use server" module -- these are server-internal helpers, never exposed
// as callable server actions. provisionInvite does NO authorization of its own,
// so exposing it to the client would be an open "invite anyone at any role"
// hole. Its callers (invite.ts, companyAdmin.ts) do the auth + derive
// company_id/role from trusted sources, never from raw form input.

export const INVITE_MISCONFIGURED = "Invites aren't set up correctly yet. Please contact NTITT support.";

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

/** Friendly copy for the one invite error an admin can actually act on. */
export function inviteErrorMessage(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "Someone with that email already has an account.";
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
  if (error || !data.user) return { ok: false, message: inviteErrorMessage(error?.message ?? "") };

  const { error: profileError } = await admin.from("profiles").upsert(
    { id: data.user.id, company_id: params.companyId, role: params.role, display_name: params.displayName },
    { onConflict: "id" }
  );
  if (profileError) {
    return { ok: false, message: "Invite sent, but finishing account setup failed. Please try again." };
  }
  return { ok: true };
}
