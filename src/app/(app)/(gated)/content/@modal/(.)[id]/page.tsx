import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentItem } from "@/lib/content/queries";
import { getContentResumeState } from "@/lib/content/progress";
import { contentAssetSignedUrl } from "@/lib/content/brain";
import { WatchModal } from "@/components/content/WatchModal";
import type { ContentItem } from "@/types/database";

/**
 * Intercepting route: when a Library card is clicked (soft nav to /content/[id]),
 * this renders the watch MODAL over the Library instead of the full page. Mirrors
 * the standalone page's data fetch (content/[id]/page.tsx) — RLS decides
 * visibility, so an item the viewer can't see simply isn't found — then hands it
 * to the client modal. A hard load / refresh of /content/[id] skips this and
 * renders the full page.
 */
export default async function InterceptedWatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let item: ContentItem | null = null;
  let mediaUrl: string | null = null;
  try {
    const supabase = await createClient();
    item = await getContentItem(supabase, id);
    if (item) {
      if (item.external_url) {
        mediaUrl = item.external_url;
      } else if (item.asset_path) {
        // content-assets is private (20261110000000); sign the stored path at read time.
        mediaUrl = await contentAssetSignedUrl(supabase, item.asset_path);
      }
    }
  } catch {
    item = null;
  }

  if (!item) {
    notFound();
  }

  const resume = item.type === "video" && item.vimeo_id ? await getContentResumeState(item.id) : null;

  return (
    <WatchModal
      item={item}
      mediaUrl={mediaUrl}
      resumePositionSeconds={resume?.positionSeconds ?? 0}
      resumeCompleted={resume?.completed ?? false}
    />
  );
}
