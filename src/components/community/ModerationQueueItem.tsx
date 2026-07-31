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
    return <div className="rounded-lg border border-white/10 p-4 text-sm opacity-50">Handled.</div>;
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <p className="text-xs opacity-60">
        Reported by {report.reporterDisplayName}
        {report.reason ? `: "${report.reason}"` : ""}
      </p>
      <div className="mt-2 rounded-md bg-white/5 p-3 text-sm">
        {post ? (
          <>
            {post.is_removed && <p className="text-xs opacity-60">(already removed)</p>}
            <p className="whitespace-pre-wrap">{post.body}</p>
          </>
        ) : (
          <p className="opacity-60">Post no longer exists.</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <form action={removeAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="postId" value={report.post_id} />
          <input type="hidden" name="reportId" value={report.id} />
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Removal reason (optional)"
            className="flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={removePending}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {removePending ? "…" : "Remove post"}
          </button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="reportId" value={report.id} />
          <button
            type="submit"
            disabled={dismissPending}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {dismissPending ? "…" : "Dismiss"}
          </button>
        </form>
      </div>
      {(removeState.status === "error" || dismissState.status === "error") && (
        <p className="mt-2 text-xs text-red-400">
          {removeState.status === "error" ? removeState.message : dismissState.status === "error" ? dismissState.message : ""}
        </p>
      )}
    </div>
  );
}
