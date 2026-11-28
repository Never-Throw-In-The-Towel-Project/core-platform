import { requireFullAccess } from "@/lib/billing/entitlement";

/**
 * Entitlement gate for every Pro feature. All Pro routes live under this nested
 * route group (URLs are unchanged — route groups are transparent), so a single
 * gate covers them all, now and as new pages are added. A freemium Direct member
 * is bounced to /upgrade.
 *
 * Why a NESTED group rather than gating (app)/layout.tsx directly: the allowed
 * surfaces (Settings → billing, Welcome, Upgrade) stay in (app) OUTSIDE this
 * group, so a freemium member entering the gated subtree from one of them always
 * re-renders this layout and re-runs the gate — reliable even on soft navigation
 * (a shared layout would not re-run and would leak). Staff + partner members pass
 * straight through (resolveEntitlement rule 1/2). This group inherits the (app)
 * shell, so it adds only the gate, no chrome.
 */
export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  await requireFullAccess();
  return <>{children}</>;
}
