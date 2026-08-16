import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { InviteStaffForm } from "@/components/admin/InviteStaffForm";
import { NewCompanyWizard } from "@/components/admin/NewCompanyWizard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "neverthrowinthetowel.uk";

type CompanyRow = { id: string; name: string; slug: string; primary_color: string | null };

/**
 * Company management -- the Control Tower's self-serve onboarding console. The
 * wizard creates a live branded portal + invites the first HR admin in one
 * step; the list below shows every portal and who admins it. ntitt_admin only
 * (the /admin layout guards; re-asserted here as defence in depth).
 */
export default async function CompaniesPage() {
  await requireNtittAdmin();

  let companies: CompanyRow[] = [];
  const hrByCompany = new Map<string, string[]>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select("id, name, slug, primary_color")
      .order("name", { ascending: true });
    // Hide the internal "NTITT Direct" cohort -- it's the public self-signup
    // pool, not a partner portal to manage.
    companies = (data ?? []).filter((c) => c.id !== DIRECT_COMPANY_ID);

    // HR admins per company. profiles has no email column, so display_name is
    // what we show; read via service role since this ntitt_admin page lists
    // across every company.
    const admin = createAdminClient();
    const { data: hr } = await admin.from("profiles").select("display_name, company_id").eq("role", "hr_admin");
    for (const row of (hr ?? []) as { display_name: string; company_id: string }[]) {
      const list = hrByCompany.get(row.company_id) ?? [];
      list.push(row.display_name);
      hrByCompany.set(row.company_id, list);
    }
  } catch {
    companies = [];
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AdminPageHeader
        title="Companies"
        description="Stand up a branded partner portal and invite its HR admin — no DNS or engineering needed."
      />

      <div className="mt-8">
        <NewCompanyWizard />
      </div>

      <section className="mt-10">
        <h2 className="flex items-baseline gap-2 border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          All companies <span className="text-brand-accent-deep">{companies.length}</span>
        </h2>
        {companies.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No partner companies yet — create your first above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
            {companies.map((c) => {
              const admins = hrByCompany.get(c.id) ?? [];
              return (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full border border-rule-border"
                    style={{ background: c.primary_color ?? "var(--brand-accent)" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {c.slug}.{ROOT_DOMAIN}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {admins.length > 0 ? `HR: ${admins.join(", ")}` : "No HR admin yet"}
                    </p>
                  </div>
                  <Link
                    href={`/admin/companies/${c.id}`}
                    className="shrink-0 text-xs font-semibold text-brand-accent-deep hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="mt-10">
        <summary className="cursor-pointer text-sm font-semibold">Add staff to an existing company</summary>
        <p className="mt-2 text-xs text-muted">
          Invite additional people (any role) into a company that already exists.
        </p>
        <div className="mt-4">
          <InviteStaffForm companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </details>
    </main>
  );
}
