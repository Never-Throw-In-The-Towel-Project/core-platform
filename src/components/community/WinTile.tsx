import { getIsoWeekNumber } from "@/lib/routines/dates";
import { badgeLabel } from "@/lib/gamification/badges";
import { Avatar } from "./Avatar";
import type { PostWithMeta } from "@/lib/community/queries";

/**
 * A single celebratory tile on the Wins Board -- deliberately different from the
 * conversational PostCard (no like/comment/report). The win itself is the star:
 * a big accent quote mark leads into it, an optional shared badge sits above,
 * and the author signs off with an avatar in the footer.
 */
export function WinTile({ post }: { post: PostWithMeta }) {
  const week = getIsoWeekNumber(new Date(post.created_at), "UTC");

  return (
    <article className="flex min-h-44 flex-col justify-between border border-rule-border bg-background p-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">Week {week}</p>
          {post.shared_badge_key ? (
            <span className="shrink-0 border border-brand-accent/40 px-2 py-0.5 text-[11px] font-semibold text-brand-accent-deep">
              🏅 {badgeLabel(post.shared_badge_key)}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug">
          <span aria-hidden className="mr-1 align-[-0.35em] text-3xl leading-none text-brand-accent-vivid">
            &ldquo;
          </span>
          {post.body}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2.5 border-t border-rule-hairline pt-3">
        <Avatar name={post.authorDisplayName} className="h-8 w-8 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight">{post.authorDisplayName}</p>
          {post.authorCompanyName ? (
            <p className="truncate text-[11px] leading-tight text-muted">{post.authorCompanyName}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
