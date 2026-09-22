import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CommunityBoard,
  CommunityScope,
  CommunityIdentityPreference,
} from "@/types/database";
import { sortPosts, type FeedSort } from "@/lib/community/sort";
import { peerCommunityName, realName, inheritedCommentOverride } from "@/lib/identity/resolve";

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

// Peer-facing feed post -- a FIXED, explicit field set, deliberately NOT
// `extends CommunityPost`. The sensitive columns (user_id, identity_override,
// company_id, removed_by/removal_reason, scope/board/is_removed) must never ride
// into a "use client" component's serialized props, or a peer could deanonymise
// an author or read moderation internals straight out of the page source
// (finding A2). Ownership is not a feature here, so user_id is simply not
// projected; the author is pre-resolved to a peer-safe display name server-side.
export interface PostWithMeta {
  id: string;
  body: string;
  image_url: string | null;
  shared_badge_key: string | null;
  created_at: string;
  authorDisplayName: string;
  authorCompanyName: string | null;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
}

// Peer-facing comment -- same rule: only what the thread UI renders. No user_id
// / company_id / scope / removal columns reach the client.
export interface CommentWithAuthor {
  id: string;
  parent_comment_id: string | null;
  body: string;
  authorDisplayName: string;
}

/** Server-only shapes for the raw rows the feed queries actually select --
 *  narrower than the full DB row, and never returned to a caller. */
type FeedPostRow = {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  shared_badge_key: string | null;
  identity_override: CommunityIdentityPreference | null;
  created_at: string;
};

type FeedCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
};

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
    // Only the columns the feed actually needs. user_id + identity_override are
    // read HERE (server-side) to resolve the peer name, but are never returned
    // to the caller (see PostWithMeta) -- so they can't reach the client.
    .select("id, user_id, body, image_url, shared_badge_key, identity_override, created_at")
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

  const { data } = await query;
  const posts = (data as FeedPostRow[] | null) ?? [];
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => post.id);
  const userIds = Array.from(new Set(posts.map((post) => post.user_id)));

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

  const withMeta: PostWithMeta[] = posts.map((post) => {
    const info = authorInfo.get(post.user_id);
    // Build the peer DTO field by field -- NO `...post` spread, so user_id and
    // identity_override stay server-side. The peer-facing name is the author's
    // account default, overridden per-post when they chose to. Admins never
    // render through this path.
    return {
      id: post.id,
      body: post.body,
      image_url: post.image_url,
      shared_badge_key: post.shared_badge_key,
      created_at: post.created_at,
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

/**
 * Load the comments for MANY posts in a fixed number of round-trips instead of
 * one query fan-out per post. The feed renders up to FEED_PAGE_SIZE (50) posts;
 * reading each post's comments on its own was three queries a post (the comment
 * rows + getAuthorInfo's profiles + companies lookups) -- ~150 round-trips for a
 * full page. This does ONE comments query (`.in post_id`) plus ONE getAuthorInfo
 * across every comment author, then groups the rows in memory.
 *
 * Returns a Map keyed by post_id; each value is that post's comments in
 * created_at-ascending order (the global order the query returns is preserved
 * within a post because grouping appends in iteration order) -- identical shape
 * to what a per-post read produced. Posts with no comments are simply absent
 * from the map, so callers read `map.get(postId) ?? []`.
 */
export async function getCommentsForPosts(
  supabase: AnySupabaseClient,
  postIds: string[]
): Promise<Map<string, CommentWithAuthor[]>> {
  if (postIds.length === 0) return new Map();

  // The comments, plus each post's author + per-post identity override. The
  // override matters here: an author who posted anonymously (identity_override
  // = 'anonymous' on the post, while their account default is their real name)
  // would otherwise render under their real name the moment they replied in
  // their own thread -- silently deanonymising the post (finding A2). So the
  // post author's OWN comments on that post inherit the post's override;
  // everyone else follows their own account default.
  const [commentsRes, postAuthorsRes] = await Promise.all([
    supabase
      .from("community_comments")
      .select("id, post_id, user_id, parent_comment_id, body")
      .in("post_id", postIds)
      .eq("is_removed", false)
      .order("created_at", { ascending: true }),
    supabase.from("community_posts").select("id, user_id, identity_override").in("id", postIds),
  ]);

  const comments = (commentsRes.data as FeedCommentRow[] | null) ?? [];
  if (comments.length === 0) return new Map();

  const postAuthor = new Map<string, { authorId: string; override: CommunityIdentityPreference | null }>(
    (
      (postAuthorsRes.data as
        | { id: string; user_id: string; identity_override: CommunityIdentityPreference | null }[]
        | null) ?? []
    ).map((p) => [p.id, { authorId: p.user_id, override: p.identity_override }])
  );

  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const authorInfo = await getAuthorInfo(supabase, userIds);

  const byPost = new Map<string, CommentWithAuthor[]>();
  for (const comment of comments) {
    const info = authorInfo.get(comment.user_id);
    // Inherit the post's override ONLY for the post author's own comments.
    const override = inheritedCommentOverride(comment.user_id, postAuthor.get(comment.post_id));
    const withAuthor: CommentWithAuthor = {
      id: comment.id,
      parent_comment_id: comment.parent_comment_id,
      body: comment.body,
      authorDisplayName: info ? peerCommunityName(info, override) : "Someone",
    };
    const list = byPost.get(comment.post_id);
    if (list) list.push(withAuthor);
    else byPost.set(comment.post_id, [withAuthor]);
  }
  return byPost;
}

/** Used by the ntitt_admin moderation queue to show the REAL name behind
 *  reported content and its reporter -- admins always see the real person. */
export { getRealNames };
