// Pure comment-threading helper -- no DB access and no "server-only", so it is
// unit-testable in isolation (see threads.test.ts) and safe to import from the
// client PostCard. The only import is a TYPE (erased at build), so this file
// carries no runtime dependency on the server-only queries module.
import type { CommentWithAuthor } from "@/lib/community/queries";

export interface CommentThread extends CommentWithAuthor {
  replies: CommentWithAuthor[];
}

/**
 * Group a flat, chronologically-ordered comment list into a two-level thread:
 * top-level comments (parent_comment_id === null) in their original order, each
 * carrying its own replies (also in their original order).
 *
 * Robust to imperfect input: a comment is treated as a reply ONLY when its
 * parent is a genuine *top-level* comment in the same list. A reply whose
 * parent is missing (e.g. soft-removed by moderation) or is itself a reply is
 * promoted to top level rather than silently dropped -- the server action keeps
 * real threads two levels deep, and this keeps the reader honest if that ever
 * doesn't hold. Pure and deterministic.
 */
export function buildCommentThreads(comments: CommentWithAuthor[]): CommentThread[] {
  const topLevelIds = new Set(comments.filter((c) => !c.parent_comment_id).map((c) => c.id));
  const repliesByParent = new Map<string, CommentWithAuthor[]>();
  const topLevel: CommentWithAuthor[] = [];

  for (const comment of comments) {
    const parentId = comment.parent_comment_id;
    if (parentId && topLevelIds.has(parentId)) {
      const arr = repliesByParent.get(parentId) ?? [];
      arr.push(comment);
      repliesByParent.set(parentId, arr);
    } else {
      // Top-level, or an orphan/deep reply promoted so it is never dropped.
      topLevel.push(comment);
    }
  }

  return topLevel.map((comment) => ({ ...comment, replies: repliesByParent.get(comment.id) ?? [] }));
}
