import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPosts } from "@/lib/community/queries";
import { CommunityGuidelines } from "@/components/community/CommunityGuidelines";
import { WinTile } from "@/components/community/WinTile";
import { WinsComposerTile } from "@/components/community/WinsComposerTile";
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

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Degrading to an empty board is the same "Be the first to share a win"
  // state this page already renders for a genuinely empty week.
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  try {
    const supabase = await createClient();
    posts = await getPosts(supabase, { scope: "global", board: "wins", viewerUserId: profile.id });
  } catch {
    posts = [];
  }

  const now = new Date();
  const weekStart = getMondayOfWeek(now, "UTC");
  const weekEnd = getNextMonday(now, "UTC");
  const winsThisWeek = posts.filter((post) => post.created_at >= weekStart && post.created_at < weekEnd).length;

  return (
    <div>
      <div className="bg-brand-accent px-6 py-10 text-brand-accent-foreground">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-extrabold uppercase">Wins Board</h1>
          <p className="mt-2">
            {winsThisWeek === 0
              ? "Be the first to share a win this week."
              : `${winsThisWeek} win${winsThisWeek === 1 ? "" : "s"} shared this week.`}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <WinTile key={post.id} post={post} />
          ))}
          <WinsComposerTile />
        </div>
        <p className="mt-6 text-xs opacity-60">
          Wins are posted by choice. Nothing from your check-ins appears here automatically.
        </p>
      </div>
    </div>
  );
}
