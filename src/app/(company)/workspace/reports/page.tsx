import { requireHrAdmin } from "@/lib/auth/dal";

/**
 * Workspace › Reports -- the board-ready 90-day impact PDF, plus a plain
 * statement of the privacy boundary. The report is generated from the public
 * company_* aggregates only (see /api/reports/impact); this page reads nothing.
 */
export default async function WorkspaceReportsPage() {
  await requireHrAdmin();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-lg font-bold tracking-tight">Reports</h1>

      <div className="mt-6 border border-current/15 p-4 text-sm">
        <p className="font-semibold">90 Day Impact Report</p>
        <p className="mt-1 opacity-70">
          Board-ready PDF: participation, engagement trend, support usage, review completion. Auto-generates for
          each employee&apos;s 90-day mark, or download the company&apos;s current figures any time.
        </p>
        <a
          href="/api/reports/impact"
          className="mt-3 inline-block bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground"
        >
          Download impact report
        </a>
      </div>

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-60">Not available to you</p>
        <ul className="mt-2 space-y-1 text-sm opacity-60">
          <li>Individual answers</li>
          <li>Sleep scores and day ratings</li>
          <li>Who used the support button</li>
          <li>Journal and review content</li>
          <li>Names against any figure</li>
        </ul>
      </div>
    </main>
  );
}
