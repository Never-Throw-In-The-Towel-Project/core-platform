// Shared, pure config for the Workout Wednesday journal prompts (Anthony's
// journal -- "MOVEMENT IS MEDICINE"). Added ALONGSIDE the existing exercise
// bank + tier picker, not replacing them. No side effects and no server-only
// imports, so both the client form and the server action import the same keys.
// These answers ride in the existing themed_checkins.answers jsonb next to the
// chosen `tier`, so there is no migration.

/** The reflective prompts from the journal's Workout Wednesday page. */
export const WORKOUT_WEDNESDAY_REFLECTIONS = [
  { key: "exercise_today", label: "What exercise am I doing today?" },
  { key: "body_feel", label: "How does my body feel today, physically and mentally?" },
  { key: "exercise_this_week", label: "How has my exercise been this week?" },
  { key: "planned_rest_of_week", label: "What exercise do I have planned for the rest of the week?" },
  { key: "improve_anything", label: "Do I want to improve anything, physically or mentally?" },
] as const;

/** The journal's PB tracking (running + a gym lift), kept compact as short text. */
export const WORKOUT_WEDNESDAY_PBS = [
  { key: "running_pb_current", label: "Running PB — now" },
  { key: "running_pb_target", label: "Running PB — target" },
  { key: "gym_exercise", label: "Gym exercise" },
  { key: "gym_pb_current", label: "Gym PB — now" },
  { key: "gym_pb_target", label: "Gym PB — target" },
] as const;

/** Every answer key the form may submit and the action persists (besides `tier`). */
export const WORKOUT_WEDNESDAY_PROMPT_KEYS: readonly string[] = [
  ...WORKOUT_WEDNESDAY_REFLECTIONS.map((p) => p.key),
  ...WORKOUT_WEDNESDAY_PBS.map((p) => p.key),
];
