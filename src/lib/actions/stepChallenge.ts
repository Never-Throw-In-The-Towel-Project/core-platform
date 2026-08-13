"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

const OptInSchema = z.object({
  challengeId: z.string().uuid(),
  optedIn: z.boolean(),
});

/**
 * Set the member's OWN opt-in for a company step challenge. Default is opted-in;
 * this records an explicit choice (including opting out). user_id comes from the
 * session and RLS enforces own-rows-only, so a member can only ever set their
 * own opt-in -- and because opting out is own-rows-only, no one (not even HR)
 * can see who has or hasn't opted in.
 *
 * We first confirm the challenge is one the member can actually see (their own
 * company's, non-draft -- enforced by the RLS read policy) before writing, so a
 * junk opt-in row can't be created for an arbitrary challenge id.
 */
export async function setChallengeOptInAction(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  const parsed = OptInSchema.safeParse({
    challengeId: formData.get("challengeId"),
    optedIn: formData.get("optedIn") === "true",
  });
  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  try {
    const publicClient = await createClient();
    const { data: challenge } = await publicClient
      .from("company_step_challenges")
      .select("id")
      .eq("id", parsed.data.challengeId)
      .maybeSingle();
    if (!challenge) {
      return { status: "error", message: "That challenge isn't available." };
    }

    const privateClient = await createClient("private");
    const { error } = await privateClient.from("company_step_challenge_optins").upsert(
      {
        user_id: session.userId,
        challenge_id: parsed.data.challengeId,
        opted_in: parsed.data.optedIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,challenge_id" }
    );
    if (error) {
      return { status: "error", message: "Something went wrong saving that. Please try again." };
    }
  } catch {
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  revalidatePath("/challenge");
  return { status: "success" };
}
