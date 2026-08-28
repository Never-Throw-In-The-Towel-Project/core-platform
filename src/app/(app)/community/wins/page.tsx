import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPosts, countWinsPosts } from "@/lib/community/queries";
import { CommunityGuidelines } from "@/components/community/CommunityGuidelines";
import { WinTile } from "@/components/community/WinTile";
import { WinsComposerTile } from "@/components/community/WinsComposerTile";
import { WinsScoreboard } from "@/components/community/WinsScoreboard";
import { getMondayOfWeek, getNextMonday } from "@/lib/routines/dates";

/**
 * "A dedicated Wins Board -- users share their weekly or daily wins here.
 * Celebratory in tone" (brief). Deliberately a different, sidebar-free,
 * tiled layout from the main feed (see CommunityFeedView) -- matching the
 * design reference, which gives this screen its own full-width banner and
 * grid rather than reusing the feed shell.
 *
 * The banner's aggregate line is a straightforward count of wins actually
 * posted this real week (UTC, matching how other cross-user content in
 * this app is week-scoped) -- not a count derived from anyone's private
 * check-in answers. The design reference's own wording ("6 people hit their
 * Monday goal this week") would have meant surfacing Feel Good Friday's
 * private goal-completion answers, in aggregate, to every other user --
 * a new use of that data this app has never made peer-facing before (only
 * ever the user's own view or the HR aggregate dashboard). Using actual
 * wins-board posts instead keeps the same celebratory feel without that
 * question needing to be settled first.
 */
export default async function WinsBoardPage() {
  const profile = await getProfile();

  if (!profile.community_opt_in) {
    return <CommunityGuidelines showAccept />;
  }

  const now = new Date();
  const weekStart = getMondayOfWeek(now, "UTC");
  const weekEnd = getNextMonday(now, "UTC");

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Degrading to an empty board is the same "Be the first to share a win"
  // state this page already renders for a genuinely empty week.
  //
  // The scoreboard counts are precise head-only counts (countWinsPosts), not
  // derived from `posts` -- which getPosts caps at its candidate window, so a
  // busy week or a large all-time total would otherwise undercount.
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  let winsThisWeek = 0;
  let winsAllTime = 0;
  try {
    const supabase = await createClient();
    [posts, winsThisWeek, winsAllTime] = await Promise.all([
      getPosts(supabase, { scope: "global", board: "wins", viewerUserId: profile.id }),
      countWinsPosts(supabase, { sinceIso: weekStart, untilIso: weekEnd }),
      countWinsPosts(supabase),
    ]);
  } catch {
    posts = [];
  }

  return (
    <div>
      <section className="bg-brand-background text-brand-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
              Celebrate
            </p>
            <h1 className="mt-2 text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
              Wins Board
            </h1>
            <p className="mt-3 text-muted-on-ink-2">
              {winsThisWeek === 0
                ? "Be the first to share a win this week."
                : `${winsThisWeek} win${winsThisWeek === 1 ? "" : "s"} shared this week.`}
            </p>
            {/* Wayfinding back to the member's private Trophy Room, where every
                badge lives and Share posts one here. */}
            <Link
              href="/journey"
              className="mt-4 inline-block text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-light-2 transition-opacity hover:opacity-80"
            >
              Your Trophy Room →
            </Link>
          </div>
          <div className="shrink-0 sm:min-w-[14rem]">
            <WinsScoreboard thisWeek={winsThisWeek} allTime={winsAllTime} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WinsComposerTile authorName={profile.display_name} />
          {posts.map((post) => (
            <WinTile key={post.id} post={post} />
          ))}
        </div>
        <p className="mt-6 text-xs text-muted">
          Wins are posted by choice. Nothing from your check-ins appears here automatically.
        </p>
      </div>
    </div>
  );
}
