"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireNtittAdmin, verifySession } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

const RemovePostSchema = z.object({
  postId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  reportId: z.string().uuid().optional(),
});

/**
 * "Basic moderation tools for the NTITT admin... so flagged posts can be
 * reviewed and removed quickly" -- gated by requireNtittAdmin(), which
 * redirects anyone else away, including hr_admin (see docs/ARCHITECTURE.md
 * "Community scope": that boundary is deliberate, not an oversight).
 */
export async function removeCommunityPost(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();
  const session = await verifySession();

  const parsed = RemovePostSchema.safeParse({
    postId: formData.get("postId"),
    reason: formData.get("reason") || undefined,
    reportId: formData.get("reportId") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("community_posts")
      .update({
        is_removed: true,
        removed_by: session.userId,
        removed_at: new Date().toISOString(),
        removal_reason: parsed.data.reason ?? null,
      })
      .eq("id", parsed.data.postId);

    if (error) {
      return { status: "error", message: "Something went wrong removing this post." };
    }

    if (parsed.data.reportId) {
      await supabase
        .from("community_reports")
        .update({ resolved: true, resolved_by: session.userId, resolved_at: new Date().toISOString() })
        .eq("id", parsed.data.reportId);
    }
  } catch {
    return { status: "error", message: "Something went wrong removing this post." };
  }

  revalidatePath("/community", "layout");
  return { status: "success" };
}

const DismissReportSchema = z.object({ reportId: z.string().uuid() });

/** Marks a report resolved without removing the post -- e.g. reviewed and found not to need action. */
export async function dismissCommunityReport(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();
  const session = await verifySession();

  const parsed = DismissReportSchema.safeParse({ reportId: formData.get("reportId") });
  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("community_reports")
      .update({ resolved: true, resolved_by: session.userId, resolved_at: new Date().toISOString() })
      .eq("id", parsed.data.reportId);

    if (error) {
      return { status: "error", message: "Something went wrong. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  revalidatePath("/community", "layout");
  return { status: "success" };
}
