import { notFound } from "next/navigation";
import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getChallenge, getChallengeDays } from "@/lib/challenges/queries";
import { listAllContentForAdmin } from "@/lib/content/queries";
import {
  ChallengeAuthoring,
  type AuthoringDay,
  type ContentOption,
} from "@/components/admin/ChallengeAuthoring";
import type { Challenge, ChallengeDayWithContent, ContentItem, VideoCategory } from "@/types/database";

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/** One challenge's authoring page: publish state + day sequencing. ntitt_admin only. */
export default async function AdminChallengeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNtittAdmin();
  const { id } = await params;

  let challenge: Challenge | null = null;
  let days: ChallengeDayWithContent[] = [];
  let content: ContentItem[] = [];
  try {
    const supabase = await createClient();
    challenge = await getChallenge(supabase, id);
    if (challenge) {
      [days, content] = await Promise.all([getChallengeDays(supabase, id), listAllContentForAdmin(supabase)]);
    }
  } catch {
    challenge = null;
  }

  if (!challenge) notFound();

  const authoringDays: AuthoringDay[] = days.map((d) => ({
    id: d.id,
    day_index: d.day_index,
    prompt: d.prompt,
    content_title: d.content?.title ?? null,
  }));
  const contentOptions: ContentOption[] = content.map((c) => ({
    id: c.id,
    title: c.title,
    is_published: c.is_published,
  }));
  const nextDayIndex = days.reduce((max, d) => Math.max(max, d.day_index), 0) + 1;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/challenges"
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep hover:underline"
      >
        ← All challenges
      </Link>
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
        {CATEGORY_LABEL[challenge.category]} · {challenge.length_days} days
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{challenge.title}</h1>
      {challenge.summary && <p className="mt-1 text-sm text-muted">{challenge.summary}</p>}
      <p className="mt-2">
        <Link href={`/challenges/${challenge.id}`} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-foreground">
          Preview member view →
        </Link>
      </p>

      <div className="mt-8">
        <ChallengeAuthoring
          challengeId={challenge.id}
          isPublished={challenge.is_published}
          days={authoringDays}
          contentOptions={contentOptions}
          nextDayIndex={nextDayIndex}
        />
      </div>
    </main>
  );
}
