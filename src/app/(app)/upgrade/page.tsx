import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { getEntitlement } from "@/lib/billing/entitlement";
import { startTrial, createCheckout } from "@/lib/actions/billing";
import { PRO_MONTHLY_PENCE, PRO_ANNUAL_PENCE, TRIAL_DAYS } from "@/lib/billing/plans";
import type { BillingCustomer } from "@/types/database";

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

const PRIMARY =
  "bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground";
const SECONDARY = "border border-rule-border px-4 py-2.5 text-sm font-semibold hover:bg-foreground/[0.03]";

/**
 * The paywall. Where the (gated) layout sends freemium Direct members. Full-access
 * members never see it (redirected home), so it's safe for it to live in (app).
 * Get Support stays reachable from the shared app header; Events + Settings are
 * linked below — the whole free-plan allowlist.
 */
export default async function UpgradePage() {
  const profile = await getProfile();
  if ((await getEntitlement()) === "full") redirect("/home");
  // Only Direct members can be freemium; anyone else shouldn't be here.
  if (!(profile.role === "employee" && profile.company_id === DIRECT_COMPANY_ID)) redirect("/home");

  const supabase = await createClient();
  const { data: bcData } = await supabase
    .from("billing_customers")
    .select("trial_started_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  const trialUsed = Boolean((bcData as Pick<BillingCustomer, "trial_started_at"> | null)?.trial_started_at);

  return (
    <div data-surface="ink" className="min-h-full bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">Unlock the full platform</h1>
        <p className="mt-3 text-sm text-muted">
          Your free plan keeps the Get support button and the Events page. Go Pro to unlock everything else — your
          morning &amp; night routines, the weekly planner and reviews, the Library, challenges, the community and
          your Journey.
        </p>

        {!trialUsed && (
          <div className="mt-8 border border-brand-accent bg-brand-accent/[0.06] p-5">
            <p className="text-sm font-semibold">Try Pro free for {TRIAL_DAYS} days</p>
            <p className="mt-1 text-xs text-muted">
              Full access, no card needed. We&apos;ll remind you before it ends — cancel any time.
            </p>
            <form action={startTrial} className="mt-4">
              <button type="submit" className={PRIMARY}>
                Start my {TRIAL_DAYS}-day free trial
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
            {trialUsed ? "Go Pro" : "Or go straight to Pro"}
          </h2>
          <div className="flex flex-wrap gap-2">
            <form action={createCheckout}>
              <input type="hidden" name="interval" value="month" />
              <button type="submit" className={PRIMARY}>
                {gbp(PRO_MONTHLY_PENCE)}/month
              </button>
            </form>
            <form action={createCheckout}>
              <input type="hidden" name="interval" value="year" />
              <button type="submit" className={SECONDARY}>
                {gbp(PRO_ANNUAL_PENCE)}/year — save 10%
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 border-t border-rule-hairline pt-6">
          <p className="text-xs text-muted">On the free plan you can still:</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <span className="text-xs text-muted">
              Use <strong className="text-foreground">Get support</strong> — it&apos;s always in the menu above.
            </span>
            <Link href="/events" className="text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep">
              View events →
            </Link>
            <Link href="/settings" className="text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep">
              Manage account →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
