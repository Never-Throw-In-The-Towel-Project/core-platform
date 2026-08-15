import { notFound } from "next/navigation";
import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getContentItem } from "@/lib/content/queries";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import type { ContentItem } from "@/types/database";

/**
 * Edit one content item -- the counterpart to the Studio's create composer.
 * ntitt_admin only (layout guard + requireNtittAdmin here). Loads the item, the
 * partner companies (for the channel checkboxes), and the item's current channel
 * placements (which listAllContentForAdmin doesn't join) so the form prefills
 * accurately; the shared ContentStudioForm then submits to updateContentItem.
 */
export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNtittAdmin();
  const { id } = await params;

  let item: ContentItem | null = null;
  let companies: { id: string; name: string }[] = [];
  let channelIds: string[] = [];
  try {
    const supabase = await createClient();
    item = await getContentItem(supabase, id);
    if (item) {
      const [companiesResult, placementsResult] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("content_channel_placements").select("company_id").eq("content_item_id", id),
      ]);
      companies = (companiesResult.data as { id: string; name: string }[] | null) ?? [];
      channelIds = ((placementsResult.data as { company_id: string }[] | null) ?? []).map((r) => r.company_id);
    }
  } catch {
    item = null;
  }

  if (!item) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/content"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← Content Studio
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Edit content</h1>
      <p className="mt-1 text-sm text-muted">Change any field and save. Leave the media blank to keep it as is.</p>

      <div className="mt-8">
        <ContentStudioForm companies={companies} item={item} existingChannelIds={channelIds} />
      </div>
    </main>
  );
}
