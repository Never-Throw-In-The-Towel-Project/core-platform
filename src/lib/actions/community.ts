"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadCommunityImage } from "@/lib/community/imageUpload";
import { type RoutineActionState } from "./routineState";

const PostSchema = z.object({
  scope: z.enum(["global", "company"]),
  board: z.enum(["feed", "wins"]),
  body: z.string().trim().min(1).max(2000),
});

/**
 * Community posts require community_opt_in, set the first time someone
 * accepts the guidelines (acceptCommunityGuidelines below) -- not checked
 * only here, RLS enforces the same condition on the insert itself (see the
 * Phase 7 migration), so this is a friendlier error message, not the real
 * boundary. company_id always comes from the caller's own profile, never a
 * client-submitted value, even though RLS would reject a mismatched one
 * anyway -- same defense-in-depth pattern as every other action here.
 *
 * The photo, if any, arrives as a real File (Phase 9 -- replaces the
 * pasted-URL interim from Phase 7) and is uploaded to the `community-images`
 * Storage bucket before the row is inserted, so image_url always ends up
 * either null or a real uploaded photo's public URL.
 */
export async function submitCommunityPost(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  if (!profile.community_opt_in) {
    return { status: "error", message: "Please accept the community guidelines first." };
  }

  const parsed = PostSchema.safeParse({
    scope: formData.get("scope"),
    board: formData.get("board"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please write something before posting." };
  }

  const supabase = await createClient();

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const result = await uploadCommunityImage(supabase, session.userId, image);
    if ("error" in result) {
      return { status: "error", message: result.error };
    }
    imageUrl = result.url;
  }

  const { error } = await supabase.from("community_posts").insert({
    user_id: session.userId,
    company_id: profile.company_id,
    scope: parsed.data.scope,
    board: parsed.data.board,
    body: parsed.data.body,
    image_url: imageUrl,
  });

  if (error) {
    return { status: "error", message: "Something went wrong posting this. Please try again." };
  }

  revalidatePath("/community", "layout");
  return { status: "success" };
}

const CommentSchema = z.object({
  postId: z.string().uuid(),
  scope: z.enum(["global", "company"]),
  body: z.string().trim().min(1).max(1000),
});

export async function submitCommunityComment(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const profile = await getProfile();

  if (!profile.community_opt_in) {
    return { status: "error", message: "Please accept the community guidelines first." };
  }

  const parsed = CommentSchema.safeParse({
    postId: formData.get("postId"),
    scope: formData.get("scope"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please write a comment first." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("community_comments").insert({
    post_id: parsed.data.postId,
    user_id: session.userId,
    scope: parsed.data.scope,
    company_id: profile.company_id,
    body: parsed.data.body,
  });

  if (error) {
    return { status: "error", message: "Something went wrong saving this. Please try again." };
  }

  revalidatePath("/community", "layout");
  return { status: "success" };
}

/**
 * Called directly from a client component's click handler (via
 * startTransition), not a form action -- there's no form here, just a
 * toggle.
 */
export async function toggleCommunityLike(postId: string): Promise<{ liked: boolean }> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("community_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("community_likes").delete().eq("id", existing.id);
    return { liked: false };
  }

  await supabase.from("community_likes").insert({ post_id: postId, user_id: session.userId });
  return { liked: true };
}

const ReportSchema = z.object({
  postId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

/** "Report button on every post" -- the brief's non-negotiable moderation entry point. */
export async function reportCommunityPost(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = ReportSchema.safeParse({
    postId: formData.get("postId"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("community_reports").insert({
    post_id: parsed.data.postId,
    reporter_user_id: session.userId,
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    return { status: "error", message: "Something went wrong reporting this. Please try again." };
  }

  return { status: "success" };
}

/** "Community guidelines displayed on first visit" -- accepting sets the flag that unlocks posting. */
export async function acceptCommunityGuidelines(): Promise<{ ok: boolean }> {
  const session = await verifySession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ community_opt_in: true })
    .eq("id", session.userId);

  if (!error) revalidatePath("/community", "layout");
  return { ok: !error };
}

const PodcastOptInSchema = z.object({ optIn: z.enum(["true", "false"]) });

/**
 * "Podcast guest opt-in -- a way for users to express interest... feeds
 * into a private list for Anthony to review, not a public sign-up" -- see
 * src/app/(app)/community/admin/podcast-guests for that list.
 */
export async function updatePodcastGuestOptIn(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const parsed = PodcastOptInSchema.safeParse({ optIn: formData.get("optIn") });

  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ podcast_guest_opt_in: parsed.data.optIn === "true" })
    .eq("id", session.userId);

  if (error) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
