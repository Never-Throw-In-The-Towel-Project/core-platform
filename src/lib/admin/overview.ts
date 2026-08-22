import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { summarizeContentItems, type AdminOverviewData } from "@/lib/admin/overviewSummary";

export { emptyAdminOverview } from "@/lib/admin/overviewSummary";
export type { AdminOverviewData, ContentSummary } from "@/lib/admin/overviewSummary";

/**
 * Super Admin Overview — the platform-wide "at a glance" numbers for the Admin
 * Centre home. This gatherer (PR1) covers everything an `ntitt_admin` can read
 * through their own RLS-scoped session: content, community, events, notices,
 * challenges, podcast, companies. Member/tenant headcounts and company
 * engagement aggregates (which RLS deliberately hides even from super admins)
 * are added in later PRs via the service-role client.
 *
 * Privacy: NOTHING here reads the `private` schema, and nothing reads or reports
 * an individual member's check-ins, ratings, reviews, steps, or habits. Every
 * number is operational/aggregate content-and-community data. That line is a
 * product promise (docs/ARCHITECTURE.md; the init-schema header), enforced here
 * by *what we query*, one table at a time. Booking PII (guest names/emails) is
 * never selected — only head counts.
 */

// The content/community/etc. tables live in `public`; callers pass whichever
// client they already hold, same loose typing as lib/content/queries.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

const countOf = (res: { count: number | null }): number => res.count ?? 0;

/**
 * Gather every metric readable through the caller's own `ntitt_admin` session.
 * Must be called after `requireNtittAdmin()`. Content is fetched once (the whole
 * admin list) and summarised in code; everything else is a `head:true` exact
 * count, all fired concurrently.
 */
export async function getAdminOverview(supabase: AnyClient): Promise<AdminOverviewData> {
  const now = Date.now();
  const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const headCount = (build: () => PromiseLike<{ count: number | null }>) => build();

  const [items, counts] = await Promise.all([
    listAllContentForAdmin(supabase),
    Promise.all([
      // 0 companies
      headCount(() => supabase.from("companies").select("*", { count: "exact", head: true })),
      // 1 brain folders
      headCount(() => supabase.from("content_folders").select("*", { count: "exact", head: true })),
      // 2 feed posts
      headCount(() =>
        supabase
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("board", "feed")
          .eq("is_removed", false)
      ),
      // 3 wins posts
      headCount(() =>
        supabase
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("board", "wins")
          .eq("is_removed", false)
      ),
      // 4 posts in the last 7 days
      headCount(() =>
        supabase
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("is_removed", false)
          .gte("created_at", sevenDaysAgoIso)
      ),
      // 5 comments
      headCount(() =>
        supabase
          .from("community_comments")
          .select("*", { count: "exact", head: true })
          .eq("is_removed", false)
      ),
      // 6 likes
      headCount(() => supabase.from("community_likes").select("*", { count: "exact", head: true })),
      // 7 badges shared to the community
      headCount(() =>
        supabase
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("is_removed", false)
          .not("shared_badge_key", "is", null)
      ),
      // 8 open moderation reports
      headCount(() =>
        supabase.from("community_reports").select("*", { count: "exact", head: true }).eq("resolved", false)
      ),
      // 9 resolved moderation reports
      headCount(() =>
        supabase.from("community_reports").select("*", { count: "exact", head: true }).eq("resolved", true)
      ),
      // 10 published events
      headCount(() =>
        supabase.from("events").select("*", { count: "exact", head: true }).eq("is_published", true)
      ),
      // 11 upcoming (published, not cancelled, starts in the future)
      headCount(() =>
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("is_published", true)
          .is("cancelled_at", null)
          .gt("starts_at", nowIso)
      ),
      // 12 confirmed bookings
      headCount(() =>
        supabase.from("event_bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed")
      ),
      // 13 all bookings
      headCount(() => supabase.from("event_bookings").select("*", { count: "exact", head: true })),
      // 14 published challenges
      headCount(() =>
        supabase.from("challenges").select("*", { count: "exact", head: true }).eq("is_published", true)
      ),
      // 15 live notices
      headCount(() =>
        supabase.from("notices").select("*", { count: "exact", head: true }).eq("is_published", true)
      ),
      // 16 podcast episodes
      headCount(() => supabase.from("podcast_episodes").select("*", { count: "exact", head: true })),
    ]),
  ]);

  const [
    companiesRes,
    foldersRes,
    feedRes,
    winsRes,
    posts7dRes,
    commentsRes,
    likesRes,
    badgesRes,
    openReportsRes,
    resolvedReportsRes,
    eventsPublishedRes,
    eventsUpcomingRes,
    bookingsConfirmedRes,
    bookingsTotalRes,
    challengesRes,
    noticesRes,
    podcastRes,
  ] = counts;

  return {
    generatedAt: nowIso,
    companies: countOf(companiesRes),
    content: { ...summarizeContentItems(items, now), folders: countOf(foldersRes) },
    community: {
      feedPosts: countOf(feedRes),
      winsPosts: countOf(winsRes),
      postsLast7d: countOf(posts7dRes),
      comments: countOf(commentsRes),
      likes: countOf(likesRes),
      badgesShared: countOf(badgesRes),
      openReports: countOf(openReportsRes),
      resolvedReports: countOf(resolvedReportsRes),
    },
    events: {
      published: countOf(eventsPublishedRes),
      upcoming: countOf(eventsUpcomingRes),
      bookingsConfirmed: countOf(bookingsConfirmedRes),
      bookingsTotal: countOf(bookingsTotalRes),
    },
    programming: {
      challengesPublished: countOf(challengesRes),
      noticesLive: countOf(noticesRes),
      podcastEpisodes: countOf(podcastRes),
    },
  };
}
