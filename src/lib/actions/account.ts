"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/auth/dal";
import { type RoutineActionState } from "./routineState";

/**
 * Right to erasure (UK GDPR Art. 17). Deletes the caller's OWN auth account,
 * which cascades every table keyed to auth.users(id): profiles and all the
 * private wellbeing tables (morning/night/themed, weekly/periodic reviews,
 * steps, badges, challenge participation, opt-ins) plus the public community
 * posts/comments/likes/reports and push subscriptions -- all ON DELETE CASCADE.
 *
 * The only refs that do NOT cascade are nullable authorship/moderator columns
 * (created_by / removed_by / resolved_by) that exist for admins who authored
 * content or moderated. We null those first so the profiles delete is never
 * blocked, AND so the person's authorship is anonymised rather than left under
 * their id. Irreversible -- gated behind a typed "DELETE" confirmation, and it
 * only ever acts on the caller's own id (session.userId, never a form value).
 */
export async function deleteAccount(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  const session = await verifySession();

  if ((formData.get("confirm") ?? "").toString().trim().toUpperCase() !== "DELETE") {
    return { status: "error", message: "Type DELETE to confirm." };
  }

  try {
    const admin = createAdminClient();
    const uid = session.userId; // == profiles.id == the value in every created_by/removed_by

    // Nullable authorship / moderator refs that don't cascade -- null them so
    // the delete isn't blocked and authorship is anonymised.
    await admin.from("challenges").update({ created_by: null }).eq("created_by", uid);
    await admin.from("company_step_challenges").update({ created_by: null }).eq("created_by", uid);
    await admin.from("content_items").update({ created_by: null }).eq("created_by", uid);
    await admin.from("community_posts").update({ removed_by: null }).eq("removed_by", uid);
    await admin.from("community_comments").update({ removed_by: null }).eq("removed_by", uid);
    await admin.from("community_reports").update({ resolved_by: null }).eq("resolved_by", uid);

    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) {
      return { status: "error", message: "We couldn't delete your account. Please email support@ntitt.co.uk." };
    }
  } catch {
    return { status: "error", message: "We couldn't delete your account. Please email support@ntitt.co.uk." };
  }

  // The account is gone; clear the now-orphaned session cookie, then to login.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // ignore -- the cookie references a deleted user; the redirect + middleware
    // bounce handles it either way.
  }

  redirect("/login?deleted=1");
}
