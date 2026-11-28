import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { startTrial, createCheckout, openBillingPortal } from "@/lib/actions/billing";
import { PRO_MONTHLY_PENCE, PRO_ANNUAL_PENCE, TRIAL_DAYS } from "@/lib/billing/plans";
import type { Subscription, BillingCustomer } from "@/types/database";

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const H2 = "text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted";
const PRIMARY =
  "bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50";
const SECONDARY = "border border-rule-border px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.03]";

function UpgradeButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={createCheckout}>
        <input type="hidden" name="interval" value="month" />
        <button type="submit" className={PRIMARY}>
          Go Pro — {gbp(PRO_MONTHLY_PENCE)}/mo
        </button>
      </form>
      <form action={createCheckout}>
        <input type="hidden" name="interval" value="year" />
        <button type="submit" className={SECONDARY}>
          Or {gbp(PRO_ANNUAL_PENCE)}/year — save 10%
        </button>
      </form>
    </div>
  );
}

/**
 * Settings → Billing. Reads the member's own subscription (RLS own-row) and wires
 * the three billing actions. Partner-company members + admins get full access
 * without a personal plan, so they see no controls. The gating/paywall + a shared
 * entitlement resolver land in the next PR; this surface just manages billing.
 */
export async function BillingSection() {
  const profile = await getProfile();
  const isDirect = profile.role === "employee" && profile.company_id === DIRECT_COMPANY_ID;

  if (!isDirect) {
    return (
      <div className="mt-10 space-y-4">
        <h2 className={H2}>Subscription</h2>
        <div className="border border-rule-hairline p-4">
          <p className="text-sm font-medium">Full access</p>
          <p className="mt-1 text-xs text-muted">
            Your access is included — there&apos;s no personal subscription to manage here.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: subData }, { data: bcData }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("billing_customers").select("*").eq("user_id", profile.id).maybeSingle(),
  ]);
  const sub = subData as Subscription | null;
  const bc = bcData as BillingCustomer | null;

  const trialing = sub?.status === "trialing" && daysLeft(sub.trial_end) > 0;
  const paid = sub?.status === "active" || (sub?.status === "canceled" && daysLeft(sub.current_period_end) > 0);
  const pastDue = sub?.status === "past_due";
  const trialUsed = Boolean(bc?.trial_started_at);

  return (
    <div className="mt-10 space-y-4">
      <h2 className={H2}>Subscription</h2>
      <div className="border border-rule-hairline p-4">
        {paid ? (
          <>
            <p className="text-sm font-medium">NTITT Pro — full access</p>
            <p className="mt-1 text-xs text-muted">
              {sub?.cancel_at_period_end
                ? `Cancels on ${fmtDate(sub.current_period_end)}. You keep Pro until then.`
                : sub?.current_period_end
                  ? `Renews on ${fmtDate(sub.current_period_end)}.`
                  : "Active."}
            </p>
            <form action={openBillingPortal} className="mt-3">
              <button type="submit" className={SECONDARY}>
                Manage billing
              </button>
            </form>
          </>
        ) : pastDue ? (
          <>
            <p className="text-sm font-medium">Payment needs attention</p>
            <p className="mt-1 text-xs text-muted">
              Your last payment didn&apos;t go through. Update your card to keep Pro.
            </p>
            <form action={openBillingPortal} className="mt-3">
              <button type="submit" className={PRIMARY}>
                Update payment
              </button>
            </form>
          </>
        ) : trialing ? (
          <>
            <p className="text-sm font-medium">Free trial — {daysLeft(sub!.trial_end)} days left</p>
            <p className="mt-1 text-xs text-muted">
              You have full Pro access. Add a card before your trial ends to keep it — otherwise you&apos;ll move to
              the free plan.
            </p>
            <div className="mt-3">
              <UpgradeButtons />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Free plan</p>
            <p className="mt-1 text-xs text-muted">
              You can use Get Support and the Events page. Unlock everything with Pro.
            </p>
            {!trialUsed && (
              <form action={startTrial} className="mt-3">
                <button type="submit" className={PRIMARY}>
                  Start your {TRIAL_DAYS}-day free trial
                </button>
              </form>
            )}
            <div className="mt-3">
              <UpgradeButtons />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
