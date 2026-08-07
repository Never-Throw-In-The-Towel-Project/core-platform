import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { InviteStaffForm } from "@/components/admin/InviteStaffForm";

/**
 * ntitt_admin-only: provisions an account for any company and any role,
 * including hr_admin and other ntitt_admin accounts -- see
 * src/lib/actions/invite.ts. Gated the same way as the moderation queue
 * ((app)/community/admin) -- requireNtittAdmin() on the page itself, not a
 * layout, since (app)'s own layout already covers "is signed in at all".
 */
export default async function InviteStaffPage() {
  await requireNtittAdmin();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Falling back to an empty list is the same shape `companies ?? []`
  // already handles below, not a distinct case worth crashing this page.
  let companies: { id: string; name: string }[] | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true });
    companies = data;
  } catch {
    companies = null;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Invite someone</h1>
      <p className="mt-1 text-sm opacity-70">
        Provision an account for any company, at any role.
      </p>
      <div className="mt-6">
        <InviteStaffForm companies={companies ?? []} />
      </div>
    </main>
  );
}
