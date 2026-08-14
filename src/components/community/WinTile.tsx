import { getIsoWeekNumber } from "@/lib/routines/dates";
import { badgeLabel } from "@/lib/gamification/badges";
import type { PostWithMeta } from "@/lib/community/queries";

/**
 * A single tile on the Wins Board -- deliberately simpler than PostCard (no
 * like/comment/report affordances), matching the design reference's tiled,
 * celebratory register rather than the main feed's conversational one. A 2px
 * vivid-accent top strip (the same decorative-red device as the marketing
 * testimonial cards) marks it as a celebration without putting text on the red.
 */
export function WinTile({ post }: { post: PostWithMeta }) {
  const week = getIsoWeekNumber(new Date(post.created_at), "UTC");

  return (
    <div className="flex min-h-32 flex-col justify-between border border-rule-border border-t-2 border-t-brand-accent-vivid p-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          Week {week}
        </p>
        {post.shared_badge_key ? (
          <span className="mt-2 inline-block rounded-full border border-brand-accent/40 px-2 py-0.5 text-[11px] font-semibold text-brand-accent-deep">
            🏅 {badgeLabel(post.shared_badge_key)}
          </span>
        ) : null}
        <p className="mt-2 text-sm">{post.body}</p>
      </div>
      <p className="mt-3 text-xs text-muted">
        {post.authorDisplayName}
        {post.authorCompanyName ? ` · ${post.authorCompanyName}` : ""}
      </p>
    </div>
  );
}
