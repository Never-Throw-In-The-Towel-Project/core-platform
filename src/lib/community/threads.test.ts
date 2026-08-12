import { describe, it, expect } from "vitest";
import { buildCommentThreads, type CommentThread } from "./threads";
import type { CommentWithAuthor } from "./queries";

// Minimal factory -- only the fields buildCommentThreads reads matter; the rest
// are filled with representative values so the object satisfies the type.
function comment(id: string, parent: string | null, body = id): CommentWithAuthor {
  return {
    id,
    post_id: "post-1",
    user_id: `user-${id}`,
    scope: "global",
    company_id: "company-1",
    body,
    parent_comment_id: parent,
    is_removed: false,
    removed_by: null,
    removed_at: null,
    created_at: `2026-08-12T00:00:0${id.length}Z`,
    authorDisplayName: `Author ${id}`,
  };
}

const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("buildCommentThreads", () => {
  it("returns an empty array for no comments", () => {
    expect(buildCommentThreads([])).toEqual([]);
  });

  it("keeps a flat list of top-level comments in order, each with no replies", () => {
    const threads = buildCommentThreads([comment("a", null), comment("b", null)]);
    expect(ids(threads)).toEqual(["a", "b"]);
    expect(threads.every((t) => t.replies.length === 0)).toBe(true);
  });

  it("nests replies under their parent, preserving input order", () => {
    const threads = buildCommentThreads([
      comment("a", null),
      comment("a1", "a"),
      comment("b", null),
      comment("a2", "a"),
    ]);
    expect(ids(threads)).toEqual(["a", "b"]);
    const a = threads.find((t) => t.id === "a") as CommentThread;
    expect(ids(a.replies)).toEqual(["a1", "a2"]);
    expect((threads.find((t) => t.id === "b") as CommentThread).replies).toEqual([]);
  });

  it("promotes an orphan reply (missing parent) to top level rather than dropping it", () => {
    const threads = buildCommentThreads([comment("a", null), comment("x", "gone")]);
    expect(ids(threads)).toEqual(["a", "x"]);
    expect((threads.find((t) => t.id === "x") as CommentThread).replies).toEqual([]);
  });

  it("promotes a reply-to-a-reply (parent is itself a reply) to top level -- never silently lost", () => {
    // 'deep' points at 'a1', which is itself a reply -> 'a1' is not top-level,
    // so 'deep' must not vanish; it surfaces as its own top-level thread.
    const threads = buildCommentThreads([comment("a", null), comment("a1", "a"), comment("deep", "a1")]);
    expect(ids(threads)).toEqual(["a", "deep"]);
    expect(ids((threads.find((t) => t.id === "a") as CommentThread).replies)).toEqual(["a1"]);
  });

  it("does not mutate the input objects", () => {
    const input = [comment("a", null), comment("a1", "a")];
    const snapshot = JSON.parse(JSON.stringify(input));
    buildCommentThreads(input);
    expect(input).toEqual(snapshot);
  });
});
