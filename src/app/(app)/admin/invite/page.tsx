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
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

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
