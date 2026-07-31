"use server";

import { z } from "zod";
import { requireHrAdmin, requireNtittAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { type RoutineActionState } from "./routineState";

function buildInviteRedirect(): string {
  return new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL).toString();
}

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
 * See supabase/migrations/20260731080000_account_provisioning.sql for the
 * handle_new_user trigger this relies on: the invited user's auth.users row
 * (and profiles row) exist the moment this call succeeds, not when they
 * eventually click the invite link -- so there's no window where a signed-in
 * user has no profile.
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

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: inviter.company_id,
      role: "employee",
      display_name: parsed.data.displayName,
    },
    redirectTo: buildInviteRedirect(),
  });

  if (error) {
    return { status: "error", message: inviteErrorMessage(error.message) };
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

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      company_id: parsed.data.companyId,
      role: parsed.data.role,
      display_name: parsed.data.displayName,
    },
    redirectTo: buildInviteRedirect(),
  });

  if (error) {
    return { status: "error", message: inviteErrorMessage(error.message) };
  }

  return { status: "success" };
}
