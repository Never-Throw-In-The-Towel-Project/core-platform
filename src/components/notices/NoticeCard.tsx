import type { NoticeMediaKind } from "@/types/database";

/** The member-facing shape of a notice, independent of DB column names so the
 *  Today widget (from a stored row) and the Studio live preview (from unsaved
 *  form state) can both render the exact same card. */
export type NoticeCardData = {
  title: string;
  body: string | null;
  mediaKind: NoticeMediaKind;
  vimeoId: string | null;
  /** Resolved image URL: a stored public URL, or a local object URL in preview. */
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

/** A link is external if it points off-origin; those open in a new tab. Absolute
 *  URLs are what the CTA field accepts (validated as parseable URLs), so an
 *  internal target is written as a full URL to our own domain. */
function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * The Notice Board card. Presentational only (no hooks) so it renders from a
 * Server Component or a client preview alike. `embed` controls the Vimeo block:
 * true (the live Today page) plays the real iframe; false (the Studio preview)
 * shows a lightweight placeholder so the card doesn't fetch a player on every
 * keystroke.
 */
export function NoticeCard({ data, embed = true }: { data: NoticeCardData; embed?: boolean }) {
  const { title, body, mediaKind, vimeoId, imageUrl, ctaLabel, ctaUrl } = data;

  return (
    <article className="border border-rule-border bg-background">
      {mediaKind === "vimeo" && vimeoId ? (
        embed ? (
          <div className="aspect-video w-full overflow-hidden border-b border-rule-border bg-brand-background">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              title={title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 border-b border-rule-border bg-brand-background text-brand-foreground">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-brand-accent-light-2">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-on-ink-2">
              Vimeo · {vimeoId}
            </span>
          </div>
        )
      ) : mediaKind === "image" && imageUrl ? (
        <div className="flex max-h-[28rem] w-full items-center justify-center overflow-hidden border-b border-rule-border bg-brand-background">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage asset / local object URL preview */}
          <img src={imageUrl} alt={title} className="max-h-[28rem] w-full object-contain" />
        </div>
      ) : null}

      <div className="p-5">
        <h3 className="text-lg font-extrabold leading-tight tracking-tight">{title || "Untitled notice"}</h3>
        {body ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{body}</p> : null}
        {ctaUrl ? (
          <a
            href={ctaUrl}
            {...(isHttp(ctaUrl) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-4 inline-flex bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground transition-opacity hover:opacity-90"
          >
            {ctaLabel?.trim() || "Find out more"}
          </a>
        ) : null}
      </div>
    </article>
  );
}
