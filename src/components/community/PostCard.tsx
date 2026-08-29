"use client";

import { useActionState, useState, useTransition } from "react";
import { reportCommunityPost, submitCommunityComment, toggleCommunityLike } from "@/lib/actions/community";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { CommentWithAuthor, PostWithMeta } from "@/lib/community/queries";
import { buildCommentThreads } from "@/lib/community/threads";
import { timeAgo } from "@/lib/format/timeAgo";
import { Avatar } from "./Avatar";

export function PostCard({
  post,
  comments,
  now,
}: {
  post: PostWithMeta;
  comments: CommentWithAuthor[];
  /** Server-computed "now" (ISO), shared across cards so relative times don't
   *  mismatch between SSR and hydration. */
  now: string;
}) {
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isLikePending, startLikeTransition] = useTransition();
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const threads = buildCommentThreads(comments);
  const nowDate = new Date(now);

  const [commentState, commentAction, commentPending] = useActionState(submitCommunityComment, initialRoutineState);
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

  const commentCount = post.commentCount;
  const summaryParts: string[] = [];
  if (likeCount > 0) summaryParts.push(`♥ ${likeCount}`);
  if (commentCount > 0) summaryParts.push(`${commentCount} comment${commentCount === 1 ? "" : "s"}`);

  const barButton =
    "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors hover:bg-foreground/[0.03]";

  return (
    <article className="border border-rule-border bg-background">
      {/* Header: avatar, author, company, relative time, report */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={post.authorDisplayName} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-bold leading-tight">{post.authorDisplayName}</p>
            {post.authorCompanyName && (
              <span className="border border-rule-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {post.authorCompanyName}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">{timeAgo(post.created_at, nowDate)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          className="-m-2 shrink-0 p-2 text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
        >
          Report
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 pt-3">
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-[15px] leading-relaxed">{post.body}</p>
      </div>

      {/* Image -- full-bleed within the card, like a social post */}
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- user-pasted URL, not a local/optimizable asset
        <img src={post.image_url} alt="" className="max-h-[34rem] w-full border-y border-rule-hairline object-cover" />
      )}

      {/* Reaction summary */}
      {summaryParts.length > 0 && (
        <p className="px-4 pb-1.5 pt-3 text-xs text-muted">{summaryParts.join("  ·  ")}</p>
      )}

      {/* Action bar */}
      <div className="mt-1 flex items-stretch border-t border-rule-hairline">
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
          className={`${barButton} ${liked ? "text-brand-accent-deep" : "text-muted"}`}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this post" : "Like this post"}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {liked ? "♥" : "♡"}
          </span>
          {liked ? "Liked" : "Like"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={`${barButton} border-l border-rule-hairline text-muted`}
        >
          <span aria-hidden="true">💬</span>
          Comment
        </button>
      </div>

      {showReport && (
        <div className="border-t border-rule-hairline px-4 py-3 text-xs">
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
        <div className="space-y-3 border-t border-rule-hairline px-4 py-3">
          {threads.length === 0 && <p className="text-xs text-muted">No comments yet — start the conversation.</p>}
          {threads.map((thread) => (
            <div key={thread.id} className="space-y-2">
              <div className="flex gap-2">
                <Avatar name={thread.authorDisplayName} className="h-7 w-7 text-[11px]" />
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full bg-foreground/[0.04] px-3 py-1.5 text-xs">
                    <span className="font-semibold">{thread.authorDisplayName}</span>{" "}
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{thread.body}</span>
                  </div>
                </div>
              </div>

              {thread.replies.length > 0 && (
                <div className="ml-9 space-y-2">
                  {thread.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2">
                      <Avatar name={reply.authorDisplayName} className="h-6 w-6 text-[10px]" />
                      <div className="inline-block max-w-full bg-foreground/[0.04] px-3 py-1.5 text-xs">
                        <span className="font-semibold">{reply.authorDisplayName}</span>{" "}
                        <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reply.body}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === thread.id ? (
                <form action={commentAction} className="ml-9 flex gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="parentCommentId" value={thread.id} />
                  <input
                    name="body"
                    type="text"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${thread.authorDisplayName}…`}
                    aria-label={`Reply to ${thread.authorDisplayName}`}
                    className="flex-1 rounded-full border border-rule-border bg-transparent px-3 py-1.5 text-xs"
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
                  className="ml-9 text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                >
                  Reply
                </button>
              )}
            </div>
          ))}

          <form action={commentAction} className="flex gap-2 pt-1">
            <input type="hidden" name="postId" value={post.id} />
            <input
              name="body"
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              className="flex-1 rounded-full border border-rule-border bg-transparent px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={commentPending}
              className="bg-brand-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
            >
              {commentPending ? "…" : "Send"}
            </button>
          </form>
          {commentState.status === "error" && (
            <p className="text-xs text-brand-accent-deep">{commentState.message}</p>
          )}
        </div>
      )}
    </article>
  );
}
