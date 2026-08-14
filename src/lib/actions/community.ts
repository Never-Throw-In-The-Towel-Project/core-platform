"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession, getProfile } from "@/lib/auth/dal";
import { uploadCommunityImage } from "@/lib/community/imageUpload";
import { badgeLabel } from "@/lib/gamification/badges";
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

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
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
  } catch {
    return { status: "error", message: "Something went wrong posting this. Please try again." };
  }

  revalidatePath("/community", "layout");
  return { status: "success" };
}

const ShareBadgeSchema = z.object({ badgeKey: z.string().trim().min(1).max(64) });

/**
 * Conscious badge sharing (brief §3): a member CHOOSES to surface a badge they
 * earned privately (private.earned_badges) onto the community wins board.
 * Guards, in order:
 *   - must have opted into the community (RLS enforces the same on the insert);
 *   - must ACTUALLY own the badge -- read under the private, own-rows-only
 *     client, so a forged badge_key from the form can't be shared;
 *   - deduped so the same badge can't be posted twice.
 * Only the badge label + the member's display name become public -- no steps, no
 * challenge details, nothing else private is exposed. company_id and user_id
 * come from the caller's own profile, never the client (same pattern as posting).
 */
export async function shareBadgeAction(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await verifySession();
  const profile = await getProfile();

  if (!profile.community_opt_in) {
    return { status: "error", message: "Join the community first, then you can share a badge." };
  }

  const parsed = ShareBadgeSchema.safeParse({ badgeKey: formData.get("badgeKey") });
  if (!parsed.success) {
    return { status: "error", message: "That badge couldn't be shared." };
  }
  const badgeKey = parsed.data.badgeKey;

  try {
    // Ownership check. earned_badges is private + own-rows-only, so this both
    // authorises the share and blocks sharing a badge you don't have.
    const privateClient = await createClient("private");
    const { data: earned } = await privateClient
      .from("earned_badges")
      .select("badge_key")
      .eq("user_id", profile.id)
      .eq("badge_key", badgeKey)
      .maybeSingle();
    if (!earned) {
      return { status: "error", message: "You haven't earned that badge yet." };
    }

    const supabase = await createClient();

    // Don't let the same badge be shared twice.
    const { data: already } = await supabase
      .from("community_posts")
      .select("id")
      .eq("user_id", profile.id)
      .eq("shared_badge_key", badgeKey)
      .eq("is_removed", false)
      .limit(1);
    if (already && already.length > 0) {
      return { status: "error", message: "You've already shared this badge." };
    }

    const { error } = await supabase.from("community_posts").insert({
      user_id: profile.id,
      company_id: profile.company_id,
      scope: "global",
      board: "wins",
      body: `🏅 I earned the “${badgeLabel(badgeKey)}” badge!`,
      shared_badge_key: badgeKey,
    });
    if (error) {
      return { status: "error", message: "Couldn't share right now. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn't share right now. Please try again." };
  }

  revalidatePath("/community", "layout");
  revalidatePath("/journey");
  return { status: "success", message: "Shared to the wins board!" };
}

const CommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
  // Present only when replying. Re-derived and validated server-side below --
  // never trusted to set scope/visibility (that still comes from the post).
  parentCommentId: z.string().uuid().optional(),
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
    body: formData.get("body"),
    parentCommentId: formData.get("parentCommentId") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please write a comment first." };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();

    // scope/company_id always come from the parent post itself, never a
    // client-submitted value -- previously a tampered hidden field could
    // submit scope="global" on a reply to a company-only post, leaking that
    // reply into the platform-wide feed even though the post insert policy
    // already prevents the equivalent for posts (Phase 7 migration). This
    // select is also RLS-scoped the same as any other read, so a postId the
    // caller can't actually see (e.g. a different company's company-scoped
    // post) fails here rather than letting a comment attach to it at all.
    const { data: parentPost, error: postError } = await supabase
      .from("community_posts")
      .select("scope, company_id")
      .eq("id", parsed.data.postId)
      .single();

    if (postError || !parentPost) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }

    // Threading: a reply's parent is re-derived and validated server-side, never
    // trusted from the client. The parent must be a comment the caller can
    // actually see (RLS-scoped read) AND live on this same post; otherwise we
    // fall back to posting a plain top-level comment rather than erroring. A
    // reply to a reply is flattened onto its top-level ancestor so threads stay
    // exactly two levels deep (matching the reader in lib/community/threads.ts).
    let parentCommentId: string | null = null;
    if (parsed.data.parentCommentId) {
      const { data: parentComment } = await supabase
        .from("community_comments")
        .select("id, post_id, parent_comment_id")
        .eq("id", parsed.data.parentCommentId)
        .eq("is_removed", false)
        .maybeSingle();
      if (parentComment && parentComment.post_id === parsed.data.postId) {
        parentCommentId = parentComment.parent_comment_id ?? parentComment.id;
      }
    }

    const { error } = await supabase.from("community_comments").insert({
      post_id: parsed.data.postId,
      user_id: session.userId,
      scope: parentPost.scope,
      company_id: parentPost.company_id,
      body: parsed.data.body,
      parent_comment_id: parentCommentId,
    });

    if (error) {
      return { status: "error", message: "Something went wrong saving this. Please try again." };
    }
  } catch {
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

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
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
  } catch {
    return { liked: false };
  }
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

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("community_reports").insert({
      post_id: parsed.data.postId,
      reporter_user_id: session.userId,
      reason: parsed.data.reason ?? null,
    });

    if (error) {
      // 23505 = unique_violation on (post_id, reporter_user_id): this user
      // has already reported this post (see
      // 20260810030000_community_report_dedup.sql). Idempotent -- the report
      // is already in the moderation queue, so treat a repeat tap as success
      // rather than surfacing an error or inserting a duplicate.
      if (error.code === "23505") {
        return { status: "success" };
      }
      return { status: "error", message: "Something went wrong reporting this. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong reporting this. Please try again." };
  }

  return { status: "success" };
}

/** "Community guidelines displayed on first visit" -- accepting sets the flag that unlocks posting. */
export async function acceptCommunityGuidelines(): Promise<{ ok: boolean }> {
  const session = await verifySession();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ community_opt_in: true })
      .eq("id", session.userId);

    if (!error) revalidatePath("/community", "layout");
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

const PodcastOptInSchema = z.discriminatedUnion("optIn", [
  z.object({
    optIn: z.literal("true"),
    // Required on opt-in, per the brief's consent process -- "option to
    // remain anonymous or use first name only" isn't optional metadata,
    // it's the choice the written explanation exists to collect.
    anonymityPreference: z.enum(["full_name", "first_name_only", "anonymous"]),
  }),
  z.object({ optIn: z.literal("false") }),
]);

/**
 * "Podcast guest opt-in -- a way for users to express interest... feeds
 * into a private list for Anthony to review, not a public sign-up" -- see
 * src/app/(app)/community/admin/podcast-guests for that list.
 *
 * Consent process (found missing in a full-brief review): the brief
 * requires a written explanation of what's recorded/shared, an anonymity
 * choice, and a recorded right to withdraw at any time, "to protect the
 * guest and protect the platform legally" -- none of that had any schema
 * backing before. `podcast_guest_consented_at` is re-stamped every time
 * someone opts in (the explanation in PodcastOptIn is re-shown and
 * re-agreed to each time, including re-opting-in after a withdrawal), so
 * it's a durable proof-of-consent record, not just a UI nicety. Withdrawal
 * (optIn=false) intentionally leaves the last-recorded anonymity
 * preference and consent timestamp in place rather than clearing them --
 * that history matters if an episode was already recorded before the
 * withdrawal.
 */
export async function updatePodcastGuestOptIn(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();
  const parsed = PodcastOptInSchema.safeParse({
    optIn: formData.get("optIn"),
    anonymityPreference: formData.get("anonymityPreference") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        formData.get("optIn") === "true"
          ? "Please choose how you'd like to be credited before opting in."
          : "Something went wrong. Please try again.",
    };
  }

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update(
        parsed.data.optIn === "true"
          ? {
              podcast_guest_opt_in: true,
              podcast_guest_anonymity_preference: parsed.data.anonymityPreference,
              podcast_guest_consented_at: new Date().toISOString(),
            }
          : { podcast_guest_opt_in: false }
      )
      .eq("id", session.userId);

    if (error) {
      return { status: "error", message: "Something went wrong. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
