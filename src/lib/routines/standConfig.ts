// Shared, pure config for the Fundamentals Daily Checklist (Anthony's journal).
// No side effects and no server-only imports, so both the client widget and the
// server action/query can import the same source of truth for the field keys --
// the boolean columns in private.stand_entries.
import type { StandEntry } from "@/types/database";

// The five daily questions, verbatim from the journal's "Fundamentals Daily
// Checklist". Each maps to a boolean column; order here is the display order.
export const STAND_FUNDAMENTALS = [
  { key: "won_morning", label: "Did I win my morning?" },
  { key: "moved", label: "Have I moved today?" },
  { key: "talked", label: "Did I talk to someone today?" },
  { key: "ate_and_drank", label: "Have I eaten some natural food and drank some water today?" },
  { key: "grateful", label: "Have I took notice of something I'm grateful of today?" },
] as const;

export type StandFundamentalKey = (typeof STAND_FUNDAMENTALS)[number]["key"];

export const STAND_FUNDAMENTAL_KEYS = STAND_FUNDAMENTALS.map((f) => f.key);

/** The widget's working shape: the five yes/no answers. */
export type StandState = Record<StandFundamentalKey, boolean>;

export const EMPTY_STAND_STATE: StandState = {
  won_morning: false,
  moved: false,
  talked: false,
  ate_and_drank: false,
  grateful: false,
};

/** Map a persisted row (or null) to the widget's initial state. */
export function toStandState(entry: StandEntry | null): StandState {
  if (!entry) return EMPTY_STAND_STATE;
  return {
    won_morning: entry.won_morning,
    moved: entry.moved,
    talked: entry.talked,
    ate_and_drank: entry.ate_and_drank,
    grateful: entry.grateful,
  };
}
