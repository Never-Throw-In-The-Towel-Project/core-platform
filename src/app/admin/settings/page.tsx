import Link from "next/link";
import { requireNtittAdmin, verifySession } from "@/lib/auth/dal";
import { listSuperAdmins } from "@/lib/admin/superAdmins";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DisplayNameForm } from "@/components/settings/DisplayNameForm";
import { InviteSuperAdminForm } from "@/components/admin/InviteSuperAdminForm";

/**
 * Admin Centre › Settings. Two things: the signed-in admin's own account
 * (display name), and the platform's super-admin team -- invite another
 * ntitt_admin by email, and see who currently holds that access. ntitt_admin
 * only (the /admin layout guards; re-asserted here as defence in depth).
 */
export default async function AdminSettingsPage() {
  const profile = await requireNtittAdmin();
  const session = await verifySession();

  let superAdmins: Awaited<ReturnType<typeof listSuperAdmins>> = [];
  try {
    superAdmins = await listSuperAdmins();
  } catch {
    superAdmins = [];
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <AdminPageHeader
        title="Settings"
        description="Your account, and who else can administer the platform."
      />

      <section className="mt-8 space-y-4">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Your account</h2>
        <DisplayNameForm currentName={profile.display_name} />
        {session.email && (
          <div className="border border-rule-hairline p-4">
            <p className="text-sm font-medium">Email</p>
            <p className="mt-1 text-sm text-muted">{session.email}</p>
            <p className="mt-2 text-xs text-muted">
              Your sign-in email. To change it, contact NTITT support.
            </p>
          </div>
        )}
        <p className="text-xs text-muted">
          Manage your personal Today-screen reminders and timezone in your{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-foreground">
            member settings
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          Super admins
        </h2>

        <div className="mt-4">
          <InviteSuperAdminForm />
        </div>

        <div className="mt-6">
          <p className="flex items-baseline gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
            Current super admins <span className="text-brand-accent-deep">{superAdmins.length}</span>
          </p>
          {superAdmins.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No super admins found.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
              {superAdmins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold leading-tight">
                      {admin.displayName}
                      {admin.id === profile.id && (
                        <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-accent-deep">
                          You
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{admin.email ?? "No email on file"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
