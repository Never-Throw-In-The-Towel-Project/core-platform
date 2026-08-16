import Link from "next/link";
import { requireHrAdmin, verifySession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { DisplayNameForm } from "@/components/settings/DisplayNameForm";
import { MyCompanyForm, type MyCompany } from "@/components/company/MyCompanyForm";

/**
 * Workspace › Settings, for the HR admin: their own account (display name), and
 * their company's member-facing settings -- welcome copy, support-contact
 * routing and brand colours. requireHrAdmin() gates it (the (company) layout
 * also guards the whole group).
 *
 * The company is read through the SERVICE-ROLE client, not the session client:
 * migration 20260810020000_restrict_company_contact_columns revoked SELECT on
 * the support_contact_* columns from `authenticated` (they're first-aider PII),
 * so a session-client read of them fails -- exactly as the ntitt_admin edit
 * page already does. The read is scoped to the caller's own company_id, so it
 * only ever returns this HR admin's company.
 */
export default async function WorkspaceSettingsPage() {
  const profile = await requireHrAdmin();
  const session = await verifySession();

  let company: MyCompany | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("companies")
      .select(
        "welcome_copy, support_contact_name, support_contact_email, support_contact_phone, primary_color, accent_color"
      )
      .eq("id", profile.company_id)
      .maybeSingle();
    company = data;
  } catch {
    company = null;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Your account and your company&apos;s member-facing settings.</p>

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
          Your company
        </h2>
        <p className="mt-3 text-sm text-muted">
          Your company&apos;s name and portal address are set by NTITT and can&apos;t be changed here.
        </p>
        <div className="mt-4">
          {company ? (
            <MyCompanyForm company={company} />
          ) : (
            <p className="border border-rule-hairline p-4 text-sm text-muted">
              We couldn&apos;t load your company&apos;s settings just now. Please refresh, or contact NTITT
              support if this keeps happening.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
