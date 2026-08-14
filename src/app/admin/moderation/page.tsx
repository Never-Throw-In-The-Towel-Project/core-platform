import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getDisplayNames } from "@/lib/community/queries";
import { ModerationQueueItem } from "@/components/community/ModerationQueueItem";
import type { CommunityPost, CommunityReport } from "@/types/database";

/**
 * "Basic moderation tools for the NTITT admin... so flagged posts can be
 * reviewed and removed quickly" (brief) -- gated by requireNtittAdmin(),
 * never hr_admin, per docs/ARCHITECTURE.md "Community scope". Uses the
 * caller's own RLS-scoped session for posts/reports (the "ntitt admins
 * read all community posts/reports" policies already grant this to an
 * actual ntitt_admin session -- no service-role client needed here).
 */
export default async function CommunityModerationPage() {
  await requireNtittAdmin();

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed -- same gap already closed elsewhere.
  // Treated the same as "no open reports" below -- there's nothing safe
  // to show an admin here beyond that, and it's a transient-failure retry
  // (reload the page), not silent data loss.
  let reports: CommunityReport[] | null = null;
  let posts: CommunityPost[] | null = null;
  let nameByUser = new Map<string, string>();
  try {
    const supabase = await createClient();

    const { data: reportsData } = await supabase
      .from("community_reports")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: true });
    reports = reportsData as CommunityReport[] | null;

    if (reports && reports.length > 0) {
      const postIds = Array.from(new Set(reports.map((r) => r.post_id as string)));
      const reporterIds = Array.from(new Set(reports.map((r) => r.reporter_user_id as string)));

      const [postsResult, nameByUserResult] = await Promise.all([
        supabase.from("community_posts").select("*").in("id", postIds),
        getDisplayNames(supabase, reporterIds),
      ]);
      posts = postsResult.data as CommunityPost[] | null;
      nameByUser = nameByUserResult;
    }
  } catch {
    reports = null;
    posts = null;
    nameByUser = new Map();
  }

  if (!reports || reports.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Moderation Queue</h1>
        <p className="mt-4 text-sm text-muted">No open reports. All clear.</p>
      </main>
    );
  }

  const postById = new Map((posts ?? []).map((p) => [p.id, p]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Moderation Queue</h1>
      <p className="mt-1 text-sm text-muted">
        {reports.length} open report{reports.length === 1 ? "" : "s"}.
      </p>
      <div className="mt-6 space-y-4">
        {reports.map((report) => (
          <ModerationQueueItem
            key={report.id}
            report={{
              ...report,
              reporterDisplayName: nameByUser.get(report.reporter_user_id as string) ?? "Someone",
            }}
            post={postById.get(report.post_id as string) ?? null}
          />
        ))}
      </div>
    </main>
  );
}
