import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getDisplayNames } from "@/lib/community/queries";
import { ModerationQueueItem } from "@/components/community/ModerationQueueItem";
import type { CommunityPost } from "@/types/database";

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
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("community_reports")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: true });

  if (!reports || reports.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">Moderation Queue</h1>
        <p className="mt-4 text-sm opacity-60">No open reports. All clear.</p>
      </main>
    );
  }

  const postIds = Array.from(new Set(reports.map((r) => r.post_id as string)));
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporter_user_id as string)));

  const [{ data: posts }, nameByUser] = await Promise.all([
    supabase.from("community_posts").select("*").in("id", postIds),
    getDisplayNames(supabase, reporterIds),
  ]);

  const postById = new Map((posts as CommunityPost[] | null ?? []).map((p) => [p.id, p]));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Moderation Queue</h1>
      <p className="mt-1 text-sm opacity-70">
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
