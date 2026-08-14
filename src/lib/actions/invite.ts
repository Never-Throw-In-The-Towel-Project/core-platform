"use server";

import { z } from "zod";
import { requireHrAdmin, requireNtittAdmin } from "@/lib/auth/dal";
import { provisionInvite } from "@/lib/invite/provision";
import { type RoutineActionState } from "./routineState";

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
