"use client";

import { useActionState, useState, useTransition } from "react";
import { reportCommunityPost, submitCommunityComment, toggleCommunityLike } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { CommentWithAuthor, PostWithMeta } from "@/lib/community/queries";

export function PostCard({ post, comments }: { post: PostWithMeta; comments: CommentWithAuthor[] }) {
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isLikePending, startLikeTransition] = useTransition();
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const [commentState, commentAction, commentPending] = useActionState(
    submitCommunityComment,
    initialRoutineState
  );
  const [reportState, reportAction, reportPending] = useActionState(reportCommunityPost, initialRoutineState);

  // revalidatePath refreshes `comments` server-side on success, but the
  // controlled input itself needs clearing explicitly. Adjusting state
  // during render (React's documented pattern for this) rather than in a
  // useEffect, which would cause an extra cascading render.
  const [handledCommentState, setHandledCommentState] = useState(commentState);
  if (commentState !== handledCommentState) {
    setHandledCommentState(commentState);
    if (commentState.status === "success") setCommentBody("");
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{post.authorDisplayName}</p>
        <p className="text-xs opacity-50">{new Date(post.created_at).toLocaleDateString()}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user-pasted URL, not a local/optimizable asset
        <img src={post.image_url} alt="" className="mt-3 max-h-80 w-full rounded-md object-cover" />
      )}

      <div className="mt-3 flex items-center gap-4 text-xs opacity-70">
        <button
          type="button"
          disabled={isLikePending}
          onClick={() =>
            startLikeTransition(async () => {
              const result = await toggleCommunityLike(post.id);
              setLiked(result.liked);
              setLikeCount((count) => count + (result.liked ? 1 : -1));
            })
          }
        >
          {liked ? "♥" : "♡"} {likeCount}
        </button>
        <button type="button" onClick={() => setShowComments((v) => !v)}>
          💬 {post.commentCount}
        </button>
        <button type="button" onClick={() => setShowReport((v) => !v)} className="ml-auto">
          Report
        </button>
      </div>

      {showReport && (
        <div className="mt-3 rounded-md border border-white/10 p-3 text-xs">
          {reportState.status === "success" ? (
            <p className="opacity-70">Thanks -- this has been reported to the NTITT team.</p>
          ) : (
            <form action={reportAction} className="space-y-2">
              <input type="hidden" name="postId" value={post.id} />
              <textarea
                name="reason"
                placeholder="What's wrong with this post? (optional)"
                rows={2}
                className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
              />
              {reportState.status === "error" && <p className="text-red-400">{reportState.message}</p>}
              <button
                type="submit"
                disabled={reportPending}
                className="rounded-md bg-brand-accent px-3 py-1.5 font-semibold text-white disabled:opacity-50"
              >
                {reportPending ? "Reporting…" : "Submit report"}
              </button>
            </form>
          )}
        </div>
      )}

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {comments.length === 0 && <p className="text-xs opacity-50">No comments yet.</p>}
          {comments.map((comment) => (
            <p key={comment.id} className="text-xs">
              <span className="font-semibold">{comment.authorDisplayName}</span>{" "}
              <span className="opacity-80">{comment.body}</span>
            </p>
          ))}

          <form action={commentAction} className="flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="scope" value={post.scope} />
            <input
              name="body"
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={commentPending}
              className="rounded-md bg-brand-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {commentPending ? "…" : "Send"}
            </button>
          </form>
          {commentState.status === "error" && <p className="text-xs text-red-400">{commentState.message}</p>}
        </div>
      )}
    </div>
  );
}
