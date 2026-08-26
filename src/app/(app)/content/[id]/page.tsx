import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentItem } from "@/lib/content/queries";
import { buildVimeoEmbedUrl } from "@/lib/vimeo/parse";
import type { ContentItem } from "@/types/database";

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return `${Math.round(seconds / 60)} min`;
}

/**
 * The watch/read page a Content Library row opens into. Renders the media by
 * type off the content_items spine (docs/CONTENT_PLATFORM_STRATEGY.md): a
 * Vimeo player for video, the image itself for image, an inline frame + open
 * link for a document. Channel visibility is enforced by the content_items
 * RLS policy -- an item the viewer isn't entitled to see simply isn't found.
 */
export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed -- treated the same as "not found", since either
  // way there's nothing to safely render here.
  let item: ContentItem | null = null;
  let mediaUrl: string | null = null;
  try {
    const supabase = await createClient();
    item = await getContentItem(supabase, id);
    if (item) {
      if (item.external_url) {
        mediaUrl = item.external_url;
      } else if (item.asset_path) {
        // content-assets is a public bucket (see the spine migration); the
        // public URL is derivable without a signed-URL round-trip.
        mediaUrl = supabase.storage.from("content-assets").getPublicUrl(item.asset_path).data.publicUrl;
      }
    }
  } catch {
    item = null;
  }

  if (!item) {
    notFound();
  }

  const duration = formatDuration(item.duration_seconds);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/content"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted transition-colors hover:text-foreground"
      >
        ← Library
      </Link>

      {item.type === "video" && item.vimeo_id ? (
        <div className="mt-6 aspect-video w-full overflow-hidden border-2 border-foreground">
          <iframe
            src={buildVimeoEmbedUrl(item.vimeo_id, item.vimeo_hash)}
            title={item.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : item.type === "image" && mediaUrl ? (
        <div className="mt-6 border-2 border-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage asset, not a local/optimizable image */}
          <img src={mediaUrl} alt={item.title} className="w-full" />
        </div>
      ) : mediaUrl ? (
        <div className="mt-6">
          <div className="aspect-video w-full overflow-hidden border-2 border-foreground">
            <iframe src={mediaUrl} title={item.title} className="h-full w-full" />
          </div>
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-colors hover:opacity-90"
          >
            Open ↗
          </a>
        </div>
      ) : item.type === "text" ? null : (
        // Only a genuine media item that failed to resolve is "unavailable"; a
        // text item carries no media by design — its words are the content.
        <p className="mt-6 text-sm text-muted">This content isn’t available to view right now.</p>
      )}

      <h1 className="mt-6 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{item.title}</h1>
      {/* For a text item the summary IS the piece (a quote / daily prompt), so it
          reads as prose; for media it's a short caption under the player. */}
      {item.summary &&
        (item.type === "text" ? (
          <div className="mt-4 whitespace-pre-line text-lg leading-relaxed text-foreground">{item.summary}</div>
        ) : (
          <p className="mt-3 text-muted">{item.summary}</p>
        ))}
      {(item.tags.length > 0 || duration) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="border border-rule-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
            >
              {tag}
            </span>
          ))}
          {duration && <span className="text-xs text-muted">{duration}</span>}
        </div>
      )}
    </main>
  );
}
