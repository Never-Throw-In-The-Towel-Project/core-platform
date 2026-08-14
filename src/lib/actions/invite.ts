"use server";

import { z } from "zod";
import { requireHrAdmin, requireNtittAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { type RoutineActionState } from "./routineState";

// Null (not a throw) when NEXT_PUBLIC_SITE_URL is unset/invalid, so a
// misconfigured deploy surfaces the friendly error below instead of crashing
// the invite action uncaught (these actions have no surrounding try/catch, and
// an invite with a broken callback link is worse than a clear failure).
function buildInviteRedirect(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return null;
  try {
    return new URL("/auth/callback", base).toString();
  } catch {
    return null;
  }
}

const INVITE_MISCONFIGURED = "Invites aren't set up correctly yet. Please contact NTITT support.";

/** Friendly copy for the one error case an admin can actually act on. */
function inviteErrorMessage(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "Someone with that email already has an account.";
  }
  return "Something went wrong sending the invite. Please try again.";
}

const InviteEmployeeSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1, "Enter a name.").max(80),
});

/**
 * hr_admin invites an employee at their own company. company_id and role are
 * never taken from form input -- only from the caller's own verified profile
 * (company_id) or a fixed constant ("employee") -- so a crafted form post
 * can't escalate role or plant an account in a different company.
 *
 * The profiles row is upserted directly here, right after invite success --
 * not left to the handle_new_user trigger (see
 * supabase/migrations/20260731090000_fix_handle_new_user_non_blocking.sql):
 * testing this end-to-end found Supabase's invite API doesn't reliably
 * attach user_metadata to the same auth.users insert that trigger fires on,
 * so this server action is the actual source of truth for the values it
 * already validated, rather than round-tripping them through metadata.
 */
export async function inviteEmployee(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const inviter = await requireHrAdmin();

  const parsed = InviteEmployeeSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email and name." };
  }

  const redirectTo = buildInviteRedirect();
  if (!redirectTo) {
    return { status: "error", message: INVITE_MISCONFIGURED };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: inviter.company_id,
      role: "employee",
      display_name: parsed.data.displayName,
    },
    redirectTo,
  });

  if (error || !data.user) {
    return { status: "error", message: inviteErrorMessage(error?.message ?? "") };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      company_id: inviter.company_id,
      role: "employee",
      display_name: parsed.data.displayName,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    return {
      status: "error",
      message: "Invite sent, but finishing account setup failed. Please try again.",
    };
  }

  return { status: "success" };
}

const InviteStaffSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1, "Enter a name.").max(80),
  companyId: z.string().uuid(),
  role: z.enum(["employee", "hr_admin", "ntitt_admin"]),
});

/**
 * ntitt_admin invites anyone, to any company, as any role -- this is the one
 * place in the app that can create an hr_admin or another ntitt_admin.
 * Never exposed to hr_admin, same "platform-level, never a client's" line
 * docs/ARCHITECTURE.md draws for community moderation.
 *
 * Upserts the profiles row directly -- see the matching comment on
 * inviteEmployee above for why this doesn't rely on the handle_new_user
 * trigger alone.
 */
export async function inviteStaffMember(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = InviteStaffSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    companyId: formData.get("companyId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fill in every field correctly." };
  }

  const redirectTo = buildInviteRedirect();
  if (!redirectTo) {
    return { status: "error", message: INVITE_MISCONFIGURED };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: parsed.data.companyId,
      role: parsed.data.role,
      display_name: parsed.data.displayName,
    },
    redirectTo,
  });

  if (error || !data.user) {
    return { status: "error", message: inviteErrorMessage(error?.message ?? "") };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      company_id: parsed.data.companyId,
      role: parsed.data.role,
      display_name: parsed.data.displayName,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    return {
      status: "error",
      message: "Invite sent, but finishing account setup failed. Please try again.",
    };
  }

  return { status: "success" };
}
