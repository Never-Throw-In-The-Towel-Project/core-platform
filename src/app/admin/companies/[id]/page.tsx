import Link from "next/link";
import { notFound } from "next/navigation";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EditCompanyForm, type EditableCompany } from "@/components/admin/EditCompanyForm";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "neverthrowinthetowel.uk";

/**
 * Control Tower › Companies › edit one company. ntitt_admin only (the /admin
 * layout guards; re-asserted here). Editing is branding/copy/support only --
 * the slug (portal identity) is read-only.
 */
export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNtittAdmin();
  const { id } = await params;

  let company: EditableCompany | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select(
        "id, name, slug, welcome_copy, support_contact_name, support_contact_email, support_contact_phone, primary_color, accent_color"
      )
      .eq("id", id)
      .maybeSingle();
    company = data;
  } catch {
    company = null;
  }
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/companies"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← All companies
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{company.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Portal: {company.slug}.{ROOT_DOMAIN}
      </p>

      <div className="mt-8">
        <EditCompanyForm company={company} />
      </div>
    </main>
  );
}
