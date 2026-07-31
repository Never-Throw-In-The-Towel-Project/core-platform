import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunityBoard, CommunityComment, CommunityPost, CommunityScope } from "@/types/database";

// See the same note in src/lib/dashboard/aggregates.ts on why this is
// intentionally loose rather than the client's real schema-union generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any>;

export interface PostWithMeta extends CommunityPost {
  authorDisplayName: string;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
}

export interface CommentWithAuthor extends CommunityComment {
  authorDisplayName: string;
}

/**
 * `profiles` only has a self-read RLS policy (Phase 1: "no policy grants
 * an hr_admin row-level access to other profiles" -- deliberately, and
 * nothing added since grants any other role broader access either). That's
 * exactly right for private data, but display_name is the one column the
 * brief explicitly means to be community-facing -- every post/comment
 * needs to show its author's name to every other viewer who can already
 * see the post/comment itself (per community_posts'/community_comments' own
 * RLS). Resolving it through the caller's own RLS-scoped session would
 * silently return nothing for anyone else's row.
 *
 * This uses the service-role admin client instead, but only ever selects
 * `id, display_name` -- never any other column -- and only ever runs
 * server-side. It doesn't widen what a browser can query; it's the
 * server rendering the one field the RLS model already intends to be
 * visible to any authenticated viewer, for content that same viewer is
 * already independently authorized (via community_posts/_comments RLS) to
 * see.
 */
async function getDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", userIds);
  return new Map((data ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
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
  params: { scope: CommunityScope; board: CommunityBoard; companyId?: string; viewerUserId: string }
): Promise<PostWithMeta[]> {
  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("scope", params.scope)
    .eq("board", params.board)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.scope === "company" && params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  const { data: posts } = await query;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((post: CommunityPost) => post.id);
  const userIds = Array.from(new Set(posts.map((post: CommunityPost) => post.user_id)));

  const [nameByUser, { data: likes }, { data: comments }] = await Promise.all([
    getDisplayNames(userIds),
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

  return (posts as CommunityPost[]).map((post) => ({
    ...post,
    authorDisplayName: nameByUser.get(post.user_id) ?? "Someone",
    likeCount: likeCounts.get(post.id) ?? 0,
    likedByViewer: likedByViewer.has(post.id),
    commentCount: commentCounts.get(post.id) ?? 0,
  }));
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
  const nameByUser = await getDisplayNames(userIds);

  return (comments as CommunityComment[]).map((comment) => ({
    ...comment,
    authorDisplayName: nameByUser.get(comment.user_id) ?? "Someone",
  }));
}

/** Used by the ntitt_admin moderation queue to show who reported a post. */
export { getDisplayNames };
