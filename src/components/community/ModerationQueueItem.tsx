"use client";

import { useActionState, useState } from "react";
import { dismissCommunityReport, removeCommunityPost } from "@/lib/actions/communityModeration";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { CommunityPost, CommunityReport } from "@/types/database";

export function ModerationQueueItem({
  report,
  post,
}: {
  report: CommunityReport & { reporterDisplayName: string };
  post: CommunityPost | null;
}) {
  const [removeState, removeAction, removePending] = useActionState(removeCommunityPost, initialRoutineState);
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissCommunityReport,
    initialRoutineState
  );
  const [reason, setReason] = useState("");

  if (removeState.status === "success" || dismissState.status === "success") {
    return <div className="border border-rule-border p-4 text-sm text-muted">Handled.</div>;
  }

  return (
    <div className="border border-rule-border p-4">
      <p className="text-xs text-muted">
        Reported by {report.reporterDisplayName}
        {report.reason ? `: "${report.reason}"` : ""}
      </p>
      <div className="mt-2 border border-rule-hairline p-3 text-sm">
        {post ? (
          <>
            {post.is_removed && <p className="text-xs text-muted">(already removed)</p>}
            <p className="whitespace-pre-wrap">{post.body}</p>
          </>
        ) : (
          <p className="text-muted">Post no longer exists.</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {post && (
          <form action={removeAction} className="flex flex-1 items-center gap-2">
            <input type="hidden" name="postId" value={report.post_id} />
            <input type="hidden" name="reportId" value={report.id} />
            <input
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Removal reason (optional)"
              className="flex-1 border border-rule-border bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={removePending}
              className="shrink-0 bg-brand-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
            >
              {removePending ? "…" : "Remove post"}
            </button>
          </form>
        )}
        <form action={dismissAction}>
          <input type="hidden" name="reportId" value={report.id} />
          <button
            type="submit"
            disabled={dismissPending}
            className="border border-rule-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {dismissPending ? "…" : "Dismiss"}
          </button>
        </form>
      </div>
      {(removeState.status === "error" || dismissState.status === "error") && (
        <p className="mt-2 text-xs text-brand-accent-deep">
          {removeState.status === "error" ? removeState.message : dismissState.status === "error" ? dismissState.message : ""}
        </p>
      )}
    </div>
  );
}
