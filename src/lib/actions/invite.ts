"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHrAdmin, requireNtittAdmin } from "@/lib/auth/dal";
import { provisionInvite, revokePendingInvite } from "@/lib/invite/provision";
import { type RoutineActionState } from "./routineState";

const RevokeInviteSchema = z.object({ email: z.email() });

const InviteEmployeeSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1, "Enter a name.").max(80),
});

/**
 * hr_admin invites an employee at their own company. company_id and role are
 * never taken from form input -- only from the caller's own verified profile
 * (company_id) or a fixed constant ("employee") -- so a crafted form post
 * can't escalate role or plant an account in a different company.
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

  const result = await provisionInvite({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    companyId: inviter.company_id,
    role: "employee",
  });
  return result.ok ? { status: "success" } : { status: "error", message: result.message };
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

  const result = await provisionInvite({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    companyId: parsed.data.companyId,
    role: parsed.data.role,
  });
  return result.ok ? { status: "success" } : { status: "error", message: result.message };
}

const InviteSuperAdminSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(1, "Enter a name.").max(80),
});

/**
 * ntitt_admin invites ANOTHER ntitt_admin by email -- the /admin/settings
 * "invite a super admin" flow. Purpose-built so the form carries neither a
 * role nor a company: role is the fixed "ntitt_admin" constant, and company_id
 * is pinned to the inviter's own company (the NTITT internal pool every super
 * admin already sits in), never form input. A super admin's tenant is
 * cosmetic -- RLS grants them platform-wide access by role, not by company_id
 * -- but pinning it to "the same pool I'm in" keeps them out of any client
 * company's roster/aggregates. Same trust model as inviteStaffMember.
 */
export async function inviteSuperAdmin(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const inviter = await requireNtittAdmin();

  const parsed = InviteSuperAdminSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email and name." };
  }

  const result = await provisionInvite({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    companyId: inviter.company_id,
    role: "ntitt_admin",
  });
  if (result.ok) revalidatePath("/admin/settings");
  return result.ok ? { status: "success" } : { status: "error", message: result.message };
}

/**
 * hr_admin rescinds a pending EMPLOYEE invite at their own company (wrong
 * address, or the person left before accepting). Scoped to the caller's own
 * company; refuses anything already accepted. Mirrors inviteEmployee's trust model.
 */
export async function revokeEmployeeInvite(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const inviter = await requireHrAdmin();

  const parsed = RevokeInviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter the email the invite was sent to." };

  const result = await revokePendingInvite({ email: parsed.data.email, restrictToCompanyId: inviter.company_id });
  if (result.ok) revalidatePath("/workspace/people");
  return result.ok ? { status: "success" } : { status: "error", message: result.message };
}

/**
 * ntitt_admin rescinds any pending invite (employee / hr_admin / super admin)
 * by email — the counterpart to inviteStaffMember / inviteSuperAdmin. Refuses
 * anything already accepted.
 */
export async function revokeStaffInvite(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = RevokeInviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter the email the invite was sent to." };

  const result = await revokePendingInvite({ email: parsed.data.email, restrictToCompanyId: null });
  if (result.ok) {
    revalidatePath("/admin/companies");
    revalidatePath("/admin/settings");
  }
  return result.ok ? { status: "success" } : { status: "error", message: result.message };
}
