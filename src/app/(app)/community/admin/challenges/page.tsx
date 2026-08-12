import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllChallengesForAdmin } from "@/lib/challenges/queries";
import { ChallengeStudioForm } from "@/components/admin/ChallengeStudioForm";
import type { Challenge, VideoCategory } from "@/types/database";

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/**
 * The Studio's challenge authoring index (docs/CONTENT_PLATFORM_STRATEGY.md
 * "Pillar 3" + "Pillar 6"). ntitt_admin only, like the content Studio. Create a
 * challenge here, then open it to sequence its days. Draft challenges stay
 * invisible to members until published.
 */
export default async function AdminChallengesPage() {
  await requireNtittAdmin();

  let challenges: Challenge[] = [];
  let dayCounts = new Map<string, number>();
  try {
    const supabase = await createClient();
    const [list, daysResult] = await Promise.all([
      listAllChallengesForAdmin(supabase),
      supabase.from("challenge_days").select("challenge_id"),
    ]);
    challenges = list;
    for (const row of (daysResult.data as { challenge_id: string }[] | null) ?? []) {
      dayCounts.set(row.challenge_id, (dayCounts.get(row.challenge_id) ?? 0) + 1);
    }
  } catch {
    challenges = [];
    dayCounts = new Map();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Challenges</h1>
      <p className="mt-1 text-sm text-muted">
        Create a guided programme, then open it to sequence its days from the content library.
      </p>
      <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-muted" aria-label="Admin tools">
        <Link href="/community/admin" className="hover:text-foreground">
          Moderation
        </Link>
        <Link href="/community/admin/content" className="hover:text-foreground">
          Content
        </Link>
        <Link href="/community/admin/podcast-guests" className="hover:text-foreground">
          Podcast guests
        </Link>
        <Link href="/admin/invite" className="hover:text-foreground">
          Invite
        </Link>
      </nav>

      <div className="mt-8">
        <ChallengeStudioForm />
      </div>

      <div className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          All challenges ({challenges.length})
        </h2>
        {challenges.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet — create your first above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
            {challenges.map((c) => {
              const count = dayCounts.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Link href={`/community/admin/challenges/${c.id}`} className="min-w-0 flex-1 group">
                    <span className="block truncate font-extrabold leading-tight tracking-tight group-hover:text-brand-accent-deep">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {CATEGORY_LABEL[c.category]} · {c.length_days} days · {count} day{count === 1 ? "" : "s"} set
                    </span>
                  </Link>
                  <span
                    className={
                      "shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                      (c.is_published
                        ? "border-rule-border text-muted"
                        : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
                    }
                  >
                    {c.is_published ? "Live" : "Draft"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
