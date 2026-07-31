import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getIsoWeekNumber, resolveBankPosition } from "./dates";
import type { ContentVideo, WorkoutTier, WorkoutWeekExercise } from "@/types/database";

type VideoSummary = Pick<ContentVideo, "id" | "vimeo_id" | "title">;

export type WorkoutExercise = {
  exercise_order: number;
  exercise_name: string;
  videos: Record<WorkoutTier, VideoSummary | null>;
};

export type WeekWorkout = {
  bankPosition: number;
  exercises: WorkoutExercise[];
};

const TIER_COLUMNS = {
  beginner: "beginner_video_id",
  intermediate: "intermediate_video_id",
  advanced: "advanced_video_id",
  elite: "elite_video_id",
} as const satisfies Record<WorkoutTier, keyof WorkoutWeekExercise>;

/**
 * Resolves "the workout of the week" for `now` -- a week-journey (see
 * docs/ARCHITECTURE.md): keyed by real ISO calendar week modulo however many
 * weeks are seeded, so every user sees the same workout in the same real
 * week regardless of when they personally started. Deliberately keyed off
 * UTC, not the caller's own timezone (Phase 9) -- this is shared content
 * selection, and using each user's own zone could flip different users onto
 * different bank positions on the same calendar day near a week boundary,
 * breaking the "same workout in the same real week" guarantee this already
 * promises. Returns null if no workout weeks have been seeded yet (content
 * ops hasn't run, not an error).
 */
export async function getWorkoutForWeek(now: Date = new Date()): Promise<WeekWorkout | null> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("workout_weeks")
    .select("id", { count: "exact", head: true });

  if (!count) return null;

  const bankPosition = resolveBankPosition(getIsoWeekNumber(now, "UTC"), count);

  const { data: week } = await supabase
    .from("workout_weeks")
    .select("id, bank_position")
    .eq("bank_position", bankPosition)
    .maybeSingle();

  if (!week) return null;

  const { data: exercises } = await supabase
    .from("workout_week_exercises")
    .select("*")
    .eq("workout_week_id", week.id)
    .order("exercise_order");

  if (!exercises || exercises.length === 0) {
    return { bankPosition, exercises: [] };
  }

  const videoIds = new Set<string>();
  for (const exercise of exercises) {
    for (const tier of Object.keys(TIER_COLUMNS) as WorkoutTier[]) {
      const id = exercise[TIER_COLUMNS[tier]] as string | null;
      if (id) videoIds.add(id);
    }
  }

  const { data: videos } = videoIds.size
    ? await supabase
        .from("content_videos")
        .select("id, vimeo_id, title")
        .in("id", Array.from(videoIds))
    : { data: [] as VideoSummary[] };

  const videoById = new Map((videos ?? []).map((v) => [v.id, v]));

  const resolvedExercises: WorkoutExercise[] = exercises.map((exercise) => {
    const videos = {} as Record<WorkoutTier, VideoSummary | null>;
    for (const tier of Object.keys(TIER_COLUMNS) as WorkoutTier[]) {
      const videoId = exercise[TIER_COLUMNS[tier]] as string | null;
      videos[tier] = videoId ? videoById.get(videoId) ?? null : null;
    }
    return {
      exercise_order: exercise.exercise_order,
      exercise_name: exercise.exercise_name,
      videos,
    };
  });

  return { bankPosition, exercises: resolvedExercises };
}

/** Same "shared content, same real week for everyone" reasoning as getWorkoutForWeek -- deliberately UTC. */
export async function getDailyQuote(now: Date = new Date()) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("daily_quotes")
    .select("id", { count: "exact", head: true });

  if (!count) return null;

  const bankPosition = resolveBankPosition(getIsoWeekNumber(now, "UTC"), count);

  const { data } = await supabase
    .from("daily_quotes")
    .select("quote_text, author")
    .eq("bank_position", bankPosition)
    .maybeSingle();

  return data;
}
