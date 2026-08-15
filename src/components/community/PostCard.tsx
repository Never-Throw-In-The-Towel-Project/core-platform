"use client";

import { useActionState, useState, useTransition } from "react";
import { reportCommunityPost, submitCommunityComment, toggleCommunityLike } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { CommentWithAuthor, PostWithMeta } from "@/lib/community/queries";
import { buildCommentThreads } from "@/lib/community/threads";

export function PostCard({ post, comments }: { post: PostWithMeta; comments: CommentWithAuthor[] }) {
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isLikePending, startLikeTransition] = useTransition();
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const threads = buildCommentThreads(comments);

  const [commentState, commentAction, commentPending] = useActionState(
    submitCommunityComment,
    initialRoutineState
  );
  const [reportState, reportAction, reportPending] = useActionState(reportCommunityPost, initialRoutineState);

  // revalidatePath refreshes `comments` server-side on success, but the
  // controlled inputs themselves need clearing explicitly. Adjusting state
  // during render (React's documented pattern for this) rather than in a
  // useEffect, which would cause an extra cascading render.
  const [handledCommentState, setHandledCommentState] = useState(commentState);
  if (commentState !== handledCommentState) {
    setHandledCommentState(commentState);
    if (commentState.status === "success") {
      setCommentBody("");
      setReplyBody("");
      setReplyingTo(null);
    }
  }

  return (
    <div className="border-t border-rule-hairline py-5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <p className="font-extrabold">{post.authorDisplayName}</p>
          {post.authorCompanyName && (
            <span className="border border-rule-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {post.authorCompanyName}
            </span>
          )}
          <p className="text-xs text-muted">{new Date(post.created_at).toLocaleDateString()}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          className="-m-2 p-2 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
        >
          Report
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user-pasted URL, not a local/optimizable asset
        <img src={post.image_url} alt="" className="mt-3 max-h-80 w-full border border-rule-border object-cover" />
      )}

      <div className="mt-3 flex items-center gap-1 text-xs">
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
          className={`-m-2 flex items-center gap-1 p-2 font-semibold ${
            liked ? "text-brand-accent-deep" : "text-muted transition-colors hover:text-foreground"
          }`}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this post" : "Like this post"}
        >
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {likeCount}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="-m-2 flex items-center gap-1 p-2 font-semibold text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden="true">💬</span> {post.commentCount}
        </button>
      </div>

      {showReport && (
        <div className="mt-3 border border-rule-border p-3 text-xs">
          {reportState.status === "success" ? (
            <p className="text-muted">Thanks -- this has been reported to the NTITT team.</p>
          ) : (
            <form action={reportAction} className="space-y-2">
              <input type="hidden" name="postId" value={post.id} />
              <textarea
                name="reason"
                placeholder="What's wrong with this post? (optional)"
                aria-label="Report reason"
                rows={2}
                className="w-full border border-rule-border bg-transparent px-2 py-1"
              />
              {reportState.status === "error" && <p className="text-brand-accent-deep">{reportState.message}</p>}
              <button
                type="submit"
                disabled={reportPending}
                className="bg-brand-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
              >
                {reportPending ? "Reporting…" : "Submit report"}
              </button>
            </form>
          )}
        </div>
      )}

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-rule-hairline pt-3">
          {threads.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
          {threads.map((thread) => (
            <div key={thread.id} className="space-y-2">
              <p className="text-xs">
                <span className="font-semibold">{thread.authorDisplayName}</span>{" "}
                <span className="text-muted">{thread.body}</span>
              </p>

              {thread.replies.length > 0 && (
                <div className="ml-3 space-y-2 border-l border-rule-hairline pl-3">
                  {thread.replies.map((reply) => (
                    <p key={reply.id} className="text-xs">
                      <span className="font-semibold">{reply.authorDisplayName}</span>{" "}
                      <span className="text-muted">{reply.body}</span>
                    </p>
                  ))}
                </div>
              )}

              {replyingTo === thread.id ? (
                <form action={commentAction} className="ml-3 flex gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="parentCommentId" value={thread.id} />
                  <input
                    name="body"
                    type="text"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${thread.authorDisplayName}…`}
                    aria-label={`Reply to ${thread.authorDisplayName}`}
                    className="flex-1 border border-rule-border bg-transparent px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={commentPending}
                    className="bg-brand-accent px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
                  >
                    {commentPending ? "…" : "Reply"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(thread.id);
                    setReplyBody("");
                  }}
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                >
                  Reply
                </button>
              )}
            </div>
          ))}

          <form action={commentAction} className="flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input
              name="body"
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              className="flex-1 border border-rule-border bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={commentPending}
              className="bg-brand-accent px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
            >
              {commentPending ? "…" : "Send"}
            </button>
          </form>
          {commentState.status === "error" && (
            <p className="text-xs text-brand-accent-deep">{commentState.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
