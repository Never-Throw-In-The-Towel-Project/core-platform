import { NoticeCard } from "./NoticeCard";
import type { NoticeView } from "@/lib/notices/queries";

/**
 * The Today-page Notice Board slot. Shows the single highest-priority notice
 * that qualifies for today (the query already filters by publish state, the
 * date window, and the weekday, and orders by priority). Renders NOTHING when
 * there's nothing to show -- the null-on-empty pattern DayCarousel uses -- so it
 * never leaves an empty box on Today.
 */
export function NoticeBoard({ notices }: { notices: NoticeView[] }) {
  const notice = notices[0];
  if (!notice) return null;

  return (
    <section aria-label="Notice board">
      <NoticeCard
        data={{
          title: notice.title,
          body: notice.body,
          mediaKind: notice.media_kind,
          vimeoId: notice.vimeo_id,
          imageUrl: notice.image_url,
          videoUrl: notice.video_url,
          ctaLabel: notice.cta_label,
          ctaUrl: notice.cta_url,
        }}
      />
    </section>
  );
}
