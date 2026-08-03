import { getIsoWeekNumber } from "@/lib/routines/dates";
import type { PostWithMeta } from "@/lib/community/queries";

/**
 * A single tile on the Wins Board -- deliberately simpler than PostCard (no
 * like/comment/report affordances), matching the design reference's tiled,
 * celebratory register rather than the main feed's conversational one.
 */
export function WinTile({ post }: { post: PostWithMeta }) {
  const week = getIsoWeekNumber(new Date(post.created_at), "UTC");

  return (
    <div className="flex min-h-32 flex-col justify-between border border-current/15 p-4">
      <div>
        <p className="text-xs font-semibold text-brand-accent uppercase">Week {week}</p>
        <p className="mt-2 text-sm">{post.body}</p>
      </div>
      <p className="mt-3 text-xs opacity-60">
        {post.authorDisplayName}
        {post.authorCompanyName ? ` · ${post.authorCompanyName}` : ""}
      </p>
    </div>
  );
}
