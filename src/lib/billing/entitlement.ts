import "server-only";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import type { Profile, Subscription } from "@/types/database";

/**
 * The single source of truth for B2C feature access. See docs/SUBSCRIPTIONS_PLAN.md.
 *
 * `full`     — everything.
 * `freemium` — the allowlist only (Get Support + Events); Pro features bounce to
 *              /upgrade.
 */
export type Entitlement = "full" | "freemium";

/**
 * Pure entitlement rule (unit-tested). The partner-safety rule (#2) is the one
 * that must never regress: gating applies ONLY to Direct-company members. Staff
 * and partner-company members always have full access, so turning gating on can
 * never lock them out.
 */
export function resolveEntitlement(
  profile: Pick<Profile, "role" | "company_id">,
  sub: Pick<Subscription, "status" | "trial_end" | "current_period_end"> | null
): Entitlement {
  if (profile.role === "ntitt_admin") return "full"; // staff
  if (profile.company_id !== DIRECT_COMPANY_ID) return "full"; // partner — company-paid
  if (!sub) return "freemium";

  const now = Date.now();
  if (sub.status === "active") return "full";
  if (sub.status === "trialing" && sub.trial_end && Date.parse(sub.trial_end) > now) return "full";
  // Cancelled but paid through the end of the period keeps access until then.
  if (sub.status === "canceled" && sub.current_period_end && Date.parse(sub.current_period_end) > now) {
    return "full";
  }
  return "freemium";
}

/** The current user's entitlement — reads their profile + own subscription row. */
export async function getEntitlement(): Promise<Entitlement> {
  const profile = await getProfile();
  // Staff + partner members never depend on a subscription — skip the lookup.
  if (profile.role === "ntitt_admin" || profile.company_id !== DIRECT_COMPANY_ID) return "full";

  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, trial_end, current_period_end")
    .eq("user_id", profile.id)
    .maybeSingle();
  return resolveEntitlement(profile, (data as Subscription | null) ?? null);
}

/**
 * Page/layout guard for Pro features: bounce a freemium member to /upgrade.
 * Called from the (gated) route-group layout so EVERY Pro page is covered without
 * per-page guards, and reliably on soft navigation (a freemium member entering
 * the gated subtree from an allowed page re-renders this layout).
 */
export async function requireFullAccess(): Promise<void> {
  if ((await getEntitlement()) === "freemium") {
    redirect("/upgrade");
  }
}
