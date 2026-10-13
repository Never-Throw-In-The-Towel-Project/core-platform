// Pure, side-effect-free mappers from a saved check-in row to the values its
// form pre-fills (finding E2).
//
// The check-in forms submit EVERY field they own on each save -- a blank text
// field as null, an unticked box as false, the themed `answers` jsonb rebuilt
// from only the filled prompts. On its own that's fine; the data loss is that
// the forms never render the already-saved row, so finishing a routine in two
// sittings (or editing one field later the same day/week) re-submits a mostly
// blank form and overwrites what the first submission saved. Pre-filling closes
// it: the form re-sends the full, true state, so a re-save is a no-op on the
// fields the user didn't touch -- and, because the field is actually populated,
// the user can still clear text or untick a box on purpose.
//
// These mappers are the testable core of that fix. No "server-only" import: the
// loaders call the mappers server-side, while the client forms import only the
// Initial *types* (erased at build), so nothing server-side leaks into the
// client bundle. Inputs are the raw Supabase row objects, read defensively by
// column name so a shape surprise degrades to "blank" rather than throwing.

type Row = Record<string, unknown> | null | undefined;

function str(row: Row, key: string): string {
  const v = row?.[key];
  return typeof v === "string" ? v : "";
}

function bool(row: Row, key: string): boolean {
  return row?.[key] === true;
}

function num(row: Row, key: string): number | null {
  const v = row?.[key];
  return typeof v === "number" ? v : null;
}

export type MorningInitial = {
  sleepScore: number | null;
  morningWalk: boolean;
  breathwork: boolean;
  coldDip: boolean;
  powerList: string;
};

export function toMorningInitial(row: Row): MorningInitial {
  return {
    sleepScore: num(row, "sleep_score"),
    morningWalk: bool(row, "morning_walk"),
    breathwork: bool(row, "breathwork"),
    coldDip: bool(row, "cold_dip"),
    powerList: str(row, "power_list"),
  };
}

export type NightInitial = {
  noPhoneBeforeBed: boolean;
  hotBathOrShower: boolean;
  gratitude: string;
  highlight: string;
  dayRating: number | null;
  lookingAhead: string;
};

export function toNightInitial(row: Row): NightInitial {
  return {
    noPhoneBeforeBed: bool(row, "no_phone_before_bed"),
    hotBathOrShower: bool(row, "hot_bath_or_shower"),
    gratitude: str(row, "gratitude"),
    highlight: str(row, "highlight"),
    dayRating: num(row, "day_rating"),
    lookingAhead: str(row, "looking_ahead"),
  };
}

export type WeeklyReviewInitial = {
  habitsServedWell: string;
  challengesHelpedGrow: string;
  lessonsLearned: string;
  challengesOvercome: string;
  feelsBetterFromHabits: string;
  oneThingToImprove: string;
  habitsToDoubleDown: string;
};

export function toWeeklyReviewInitial(row: Row): WeeklyReviewInitial {
  return {
    habitsServedWell: str(row, "habits_served_well"),
    challengesHelpedGrow: str(row, "challenges_helped_grow"),
    lessonsLearned: str(row, "lessons_learned"),
    challengesOvercome: str(row, "challenges_overcome"),
    feelsBetterFromHabits: str(row, "feels_better_from_habits"),
    oneThingToImprove: str(row, "one_thing_to_improve"),
    habitsToDoubleDown: str(row, "habits_to_double_down"),
  };
}

export type SundaySetupInitial = {
  prepNotes: string;
  intention: string;
};

export function toSundaySetupInitial(row: Row): SundaySetupInitial {
  return {
    prepNotes: str(row, "prep_notes"),
    intention: str(row, "intention"),
  };
}

/**
 * The themed check-ins (Momentum Monday / Talking Tuesday / Thursday Thoughts /
 * Feel Good Friday, and the Workout Wednesday journal) store their free-text
 * answers in a single `answers` jsonb, and Monday's three goals in a `goals`
 * jsonb (`{ goals: string[] }`). `answers` keys are only present for prompts
 * that had a value, so a missing key is simply an empty field.
 */
export type ThemedInitial = {
  answers: Record<string, string>;
  goals: string[];
};

export function toThemedInitial(row: Row): ThemedInitial {
  const answers: Record<string, string> = {};
  const rawAnswers = row?.["answers"];
  if (rawAnswers && typeof rawAnswers === "object") {
    for (const [k, v] of Object.entries(rawAnswers as Record<string, unknown>)) {
      if (typeof v === "string") answers[k] = v;
    }
  }

  const rawGoals = (row?.["goals"] as { goals?: unknown } | null | undefined)?.goals;
  const goals = Array.isArray(rawGoals)
    ? rawGoals.filter((g): g is string => typeof g === "string")
    : [];

  return { answers, goals };
}
