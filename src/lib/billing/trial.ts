import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { TRIAL_DAYS } from "./plans";

export type TrialResult =
  | { ok: true }
  | { ok: false; reason: "not_eligible" | "already_used" | "already_subscribed" | "error" };

/**
 * Start the no-card, app-level 7-day Pro trial. No Stripe object, no card — just a
 * `trialing` entitlement in our DB. One trial per user EVER (guarded by
 * billing_customers.trial_started_at), so a lapsed user never gets a second free
 * trial. Service-role writes (members can't write these tables).
 *
 * Only Direct-company employees are B2C-gated, so only they are trial-eligible;
 * partner-company members and admins already have full access via the entitlement
 * resolver (rule 2), so a trial would be meaningless for them.
 */
export async function startAppTrial(params: {
  userId: string;
  companyId: string;
  role: string;
}): Promise<TrialResult> {
  if (params.role !== "employee" || params.companyId !== DIRECT_COMPANY_ID) {
    return { ok: false, reason: "not_eligible" };
  }

  const admin = createAdminClient();

  // One-trial guard.
  const { data: bc } = await admin
    .from("billing_customers")
    .select("trial_started_at")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (bc?.trial_started_at) return { ok: false, reason: "already_used" };

  // Don't hand a trial to someone who already has a real (Stripe) subscription.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("source, status")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (sub?.source === "stripe") return { ok: false, reason: "already_subscribed" };

  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { error: bcErr } = await admin
    .from("billing_customers")
    .upsert(
      { user_id: params.userId, trial_started_at: now.toISOString(), updated_at: now.toISOString() },
      { onConflict: "user_id" }
    );
  if (bcErr) return { ok: false, reason: "error" };

  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      source: "app_trial",
      status: "trialing",
      tier: "pro",
      trial_end: trialEnd.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (subErr) return { ok: false, reason: "error" };

  return { ok: true };
}
