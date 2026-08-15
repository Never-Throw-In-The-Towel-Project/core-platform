import { requireHrAdmin } from "@/lib/auth/dal";
import { InviteEmployeeForm } from "@/components/admin/InviteEmployeeForm";

/**
 * Workspace › People -- invite staff into this company. inviteEmployee derives
 * company_id + role from the caller's own profile, never form input.
 */
export default async function WorkspacePeoplePage() {
  await requireHrAdmin();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">People</h1>
      <p className="mt-1 text-sm text-muted">
        Invite your staff. Each gets an email to set a password and start their wellbeing routine.
      </p>
      <div className="mt-6">
        <InviteEmployeeForm />
      </div>
    </main>
  );
}
