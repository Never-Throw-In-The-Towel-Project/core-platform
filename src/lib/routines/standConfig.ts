// Shared, pure config for the STAND daily fundamentals checklist (Anthony's
// journal). No side effects and no server-only imports, so both the client
// widget and the server action/query can import the same source of truth for
// the field keys -- the columns in private.stand_entries.
import type { StandEntry } from "@/types/database";

export const STAND_FUNDAMENTALS = [
  { key: "hydration", label: "Hydration" },
  { key: "steps", label: "Steps" },
  { key: "alcohol_free", label: "Alcohol-free" },
  { key: "healthy_food", label: "Healthy food" },
] as const;

export type StandFundamentalKey = (typeof STAND_FUNDAMENTALS)[number]["key"];

// The five reflective prompts, one per letter of STAND (S-T-A-N-D), verbatim
// from the journal's intent.
export const STAND_REFLECTIONS = [
  { key: "strength_of_connection", letter: "S", label: "Who did I connect with or talk to today?" },
  { key: "try_new_things", letter: "T", label: "What did I learn or try today?" },
  { key: "active_lifestyle", letter: "A", label: "What physical activity did I do today?" },
  { key: "notice_the_more", letter: "N", label: "What did I notice today?" },
  { key: "do_good_for_others", letter: "D", label: "What did I do or give to someone today?" },
] as const;

export type StandReflectionKey = (typeof STAND_REFLECTIONS)[number]["key"];

export const STAND_FUNDAMENTAL_KEYS = STAND_FUNDAMENTALS.map((f) => f.key);
export const STAND_REFLECTION_KEYS = STAND_REFLECTIONS.map((r) => r.key);

/** The widget's working shape: the four ticks + the five reflection strings. */
export type StandState = Record<StandFundamentalKey, boolean> & Record<StandReflectionKey, string>;

export const EMPTY_STAND_STATE: StandState = {
  hydration: false,
  steps: false,
  alcohol_free: false,
  healthy_food: false,
  strength_of_connection: "",
  try_new_things: "",
  active_lifestyle: "",
  notice_the_more: "",
  do_good_for_others: "",
};

/** Map a persisted row (or null) to the widget's initial state. */
export function toStandState(entry: StandEntry | null): StandState {
  if (!entry) return EMPTY_STAND_STATE;
  return {
    hydration: entry.hydration,
    steps: entry.steps,
    alcohol_free: entry.alcohol_free,
    healthy_food: entry.healthy_food,
    strength_of_connection: entry.strength_of_connection ?? "",
    try_new_things: entry.try_new_things ?? "",
    active_lifestyle: entry.active_lifestyle ?? "",
    notice_the_more: entry.notice_the_more ?? "",
    do_good_for_others: entry.do_good_for_others ?? "",
  };
}
