import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CommunityBoard,
  CommunityComment,
  CommunityPost,
  CommunityScope,
  CommunityIdentityPreference,
} from "@/types/database";
import { sortPosts, type FeedSort } from "@/lib/community/sort";
import { peerCommunityName, realName } from "@/lib/identity/resolve";

// The feed pulls a recent candidate window and ranks it in application code
// (lib/community/sort.ts) rather than ordering by a likes aggregate in the DB --
// the same "provably correct by reading, no untested PostgREST aggregate" stance
// as the rest of this file. Consequence (documented, not silent): "top"/"hot"
// rank within the most recent FEED_CANDIDATE_LIMIT posts, and FEED_PAGE_SIZE are
// shown. For a company-scale wellbeing community that window is comfortably the
// whole active feed; if a board ever outgrows it, this is where paging goes.
const FEED_CANDIDATE_LIMIT = 200;
const FEED_PAGE_SIZE = 50;

// See the same note in src/lib/dashboard/aggregates.ts on why this is
// intentionally loose rather than the client's real schema-union generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

export interface PostWithMeta extends CommunityPost {
  authorDisplayName: string;
  authorCompanyName: string | null;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
}

export interface CommentWithAuthor extends CommunityComment {
  authorDisplayName: string;
}

export interface AuthorInfo {
  /** The public handle -- what peers see when the author is anonymous. */
  displayName: string;
  /** The real name (admin-visible). Null only for legacy rows not yet backfilled. */
  fullName: string | null;
  /** The author's account-level community identity default. */
  preference: CommunityIdentityPreference;
  companyName: string | null;
}

/**
 * `profiles` only has a self-read RLS policy (Phase 1: "no policy grants
 * an hr_admin row-level access to other profiles" -- deliberately, and
 * nothing added since grants any other role broader access either). That's
 * exactly right for private data, but a member's community-facing name is
 * meant to be visible to every other viewer who can already see the
 * post/comment itself (per community_posts'/community_comments' own RLS).
 * Resolving it through the caller's own RLS-scoped session would silently
 * return nothing for anyone else's row.
 *
 * This uses the service-role admin client instead, selecting ONLY the
 * identity fields the display model needs -- id, display_name (the handle),
 * full_name (the real name), community_identity_preference, company_id --
 * and only ever runs server-side. full_name never reaches a peer client: the
 * caller reduces it through peerCommunityName (which for anonymous /
 * first-name preferences never emits the full name), and only ADMIN surfaces
 * read it in full via realName(). `company_id` isn't sensitive (every post
 * carries it and `companies` is publicly readable) -- it's resolved purely to
 * attach a company *name* tag next to the author.
 */
async function getAuthorInfo(supabase: AnySupabaseClient, userIds: string[]): Promise<Map<string, AuthorInfo>> {
  if (userIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, display_name, full_name, community_identity_preference, company_id")
    .in("id", userIds);

  const companyIds = Array.from(new Set((profileRows ?? []).map((p: { company_id: string }) => p.company_id)));
  const { data: companyRows } = await supabase.from("companies").select("id, name").in("id", companyIds);
  const companyNameById = new Map((companyRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  return new Map(
    (profileRows ?? []).map(
      (p: {
        id: string;
        display_name: string;
        full_name: string | null;
        community_identity_preference: CommunityIdentityPreference;
        company_id: string;
      }) => [
        p.id,
        {
          displayName: p.display_name,
          fullName: p.full_name,
          preference: p.community_identity_preference,
          companyName: companyNameById.get(p.company_id) ?? null,
        },
      ]
    )
  );
}

/** The AUTHORS' REAL names, for ADMIN surfaces only (the moderation queue).
 *  Peers never see this -- their view always goes through peerCommunityName. */
async function getRealNames(supabase: AnySupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const authorInfo = await getAuthorInfo(supabase, userIds);
  return new Map(Array.from(authorInfo.entries()).map(([id, info]) => [id, realName(info)]));
}

/**
 * A precise count of GLOBAL wins-board posts, optionally within a time window
 * (`[sinceIso, untilIso)`). Uses a head-only exact count so it's correct beyond
 * the FEED_CANDIDATE_LIMIT window `getPosts` pages over -- the Wins Board
 * scoreboard needs the true tally, not a count derived from the fetched page.
 * Filters mirror `getPosts` (scope=global, board=wins, not is_removed); RLS on
 * the caller's client is the real visibility boundary, same as everywhere here.
 */
export async function countWinsPosts(
  supabase: AnySupabaseClient,
  range?: { sinceIso?: string; untilIso?: string }
): Promise<number> {
  let query = supabase
    .from("community_posts")
    .select("*", { count: "exact", head: true })
    .eq("scope", "global")
    .eq("board", "wins")
    .eq("is_removed", false);
  if (range?.sinceIso) query = query.gte("created_at", range.sinceIso);
  if (range?.untilIso) query = query.lt("created_at", range.untilIso);
  const { count } = await query;
  return count ?? 0;
}

/**
 * Deliberately two-query-plus-merge (posts, then likes/comments for just
 * the fetched post ids, joined in application code) rather than a single
 * PostgREST-embedded query -- likes/comments still need separate aggregate
 * queries either way, and this keeps every query here provably correct by
 * reading rather than trusting exact PostgREST embed/aggregate syntax this
 * project has no live instance to test against -- same reasoning as the
 * Phase 6 aggregation job.
 */
export async function getPosts(
  supabase: AnySupabaseClient,
  params: { scope: CommunityScope; board: CommunityBoard; companyId?: string; viewerUserId: string; sort?: FeedSort }
): Promise<PostWithMeta[]> {
  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("scope", params.scope)
    .eq("board", params.board)
    // Explicitly exclude moderated-away posts. Non-admins already never see
    // them (the base RLS policy has `not is_removed`), but the second
    // permissive policy "ntitt admins read all community posts" ORs every
    // post back in for an ntitt_admin -- so without this filter a removed
    // post reappears inline in the normal feed when an admin browses it. The
    // moderation queue reads its own path and is unaffected.
    .eq("is_removed", false)
    // Always fetch the candidate window newest-first; the requested sort is
    // applied in-app below over that window.
    .order("created_at", { ascending: false })
    .limit(FEED_CANDIDATE_LIMIT);

  if (params.scope === "company" && params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  const { data: posts } = await query;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((post: CommunityPost) => post.id);
  const userIds = Array.from(new Set(posts.map((post: CommunityPost) => post.user_id)));

  const [authorInfo, { data: likes }, { data: comments }] = await Promise.all([
    getAuthorInfo(supabase, userIds),
    supabase.from("community_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("community_comments").select("post_id").in("post_id", postIds).eq("is_removed", false),
  ]);

  const likeCounts = new Map<string, number>();
  const likedByViewer = new Set<string>();
  for (const like of likes ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (like.user_id === params.viewerUserId) likedByViewer.add(like.post_id);
  }

  const commentCounts = new Map<string, number>();
  for (const comment of comments ?? []) {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) ?? 0) + 1);
  }

  const withMeta: PostWithMeta[] = (posts as CommunityPost[]).map((post) => {
    const info = authorInfo.get(post.user_id);
    return {
      ...post,
      // Peer-facing name: the author's account default, overridden per-post when
      // they chose to (identity_override). Admins never render through this.
      authorDisplayName: info ? peerCommunityName(info, post.identity_override) : "Someone",
      authorCompanyName: info?.companyName ?? null,
      likeCount: likeCounts.get(post.id) ?? 0,
      likedByViewer: likedByViewer.has(post.id),
      commentCount: commentCounts.get(post.id) ?? 0,
    };
  });

  // Rank the candidate window by the requested sort, then take the page. "new"
  // is a no-op on the already-newest-first fetch; "top"/"hot" reorder by likes
  // and recency-weighted popularity (see lib/community/sort.ts).
  return sortPosts(withMeta, params.sort ?? "new", Date.now()).slice(0, FEED_PAGE_SIZE);
}

export async function getComments(
  supabase: AnySupabaseClient,
  postId: string
): Promise<CommentWithAuthor[]> {
  const { data: comments } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("is_removed", false)
    .order("created_at", { ascending: true });

  if (!comments || comments.length === 0) return [];

  const userIds = Array.from(new Set(comments.map((c: CommunityComment) => c.user_id)));
  const authorInfo = await getAuthorInfo(supabase, userIds);

  // Comments carry no per-post override -- they follow the author's account
  // default (peer-facing, same resolver as the feed).
  return (comments as CommunityComment[]).map((comment) => {
    const info = authorInfo.get(comment.user_id);
    return {
      ...comment,
      authorDisplayName: info ? peerCommunityName(info) : "Someone",
    };
  });
}

/** Used by the ntitt_admin moderation queue to show the REAL name behind
 *  reported content and its reporter -- admins always see the real person. */
export { getRealNames };
