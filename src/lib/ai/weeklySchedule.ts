import "server-only";
import { AI_MODEL, createAiClient } from "./client";

// Assistive WEEK scheduling for the distribution calendar: given content items,
// propose which weekday (the Mon–Sun motivation framework) each belongs on, so
// the Super Admin can lay out a week in one review instead of card by card. Like
// suggestContentTags / proposeContentOrganization, this only ever PROPOSES — the
// admin reviews the week and nothing is written until they apply it
// (docs/CONTENT_PLATFORM_STRATEGY.md).

export interface DayProposal {
  id: string;
  /** 0 = Any day (evergreen); 1 = Monday … 7 = Sunday. */
  day: number;
}

export interface ScheduleInputItem {
  id: string;
  title: string;
  summary: string | null;
  type: string;
  category: string;
  tags: string[];
}

function buildSchema(ids: string[]) {
  // `id` is constrained to the input set via enum; `day` to the 0–7 range via an
  // integer enum (structured outputs support enum, not min/max) — a hard
  // guardrail on top of normalise().
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", enum: ids },
            day: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6, 7] },
          },
          required: ["id", "day"],
        },
      },
    },
    required: ["assignments"],
  } as const;
}

const SYSTEM_PROMPT = [
  "You schedule wellbeing content across NTITT's Monday–Sunday motivation",
  "framework. NTITT is a men's mental-health platform; content assigned to a",
  "weekday surfaces to members on that day, every week.",
  "",
  "The framework's day themes:",
  "- 1 Monday — Momentum Monday: goal-setting, motivation, starting the week.",
  "- 2 Tuesday — Talking Tuesday: connection, relationships, communication, reaching out, podcasts.",
  "- 3 Wednesday — Workout Wednesday: physical fitness, movement, exercise, workouts.",
  "- 4 Thursday — Thoughts on Thursday: reflection, mindset, learning, emotions.",
  "- 5 Friday — Feel Good Friday: wins, gratitude, positivity, kindness, the weekend ahead.",
  "- 6 Saturday / 7 Sunday — open slots: rest, recovery, nutrition, longer or lighter pieces.",
  "- 0 Any day — genuinely evergreen/reference content with no day affinity.",
  "",
  "For EACH item (title, summary, type, category, tags) choose the single best",
  "day by theme fit. category is a strong hint: physical_fitness → Wednesday;",
  "mental_fitness → Monday or Thursday; nutrition → a weekend or Any day;",
  "tools_tips → Any day or Tuesday. Prefer theme fit over an even spread, but",
  "don't force a clearly evergreen piece onto a day — use 0 for those. Multiple",
  "items may share a day (a day's bank rotates weekly). Return exactly one",
  "assignment per item. This is a plan a human reviews and edits before anything",
  "is applied.",
].join("\n");

/**
 * Ask the model to place each item on a weekday (0–7). Returns validated,
 * normalised proposals keyed to the input ids. The caller (a server action) has
 * already checked isAiConfigured() + ntitt_admin and caps the batch. Throws on
 * transport/parse failure — the action catches it.
 */
export async function proposeWeeklySchedule(items: ScheduleInputItem[]): Promise<DayProposal[]> {
  if (items.length === 0) return [];
  const client = createAiClient();
  const ids = items.map((i) => i.id);

  const itemLines = items
    .map(
      (i) =>
        `- id: ${i.id}\n  title: ${i.title}\n  type: ${i.type}\n  category: ${i.category}\n  summary: ${
          i.summary?.trim() || "(none)"
        }\n  tags: ${i.tags.length ? i.tags.join(", ") : "(none)"}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema(ids) } },
    messages: [{ role: "user", content: `Items to schedule (${items.length}):\n${itemLines}` }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response contained no text block");
  }

  const raw = JSON.parse(textBlock.text) as { assignments?: unknown };
  return normalise(raw.assignments, new Set(ids));
}

/** Keep only assignments referencing a real input id (first per id) with a day
 *  in 0–7; drop anything else. */
function normalise(rawAssignments: unknown, validIds: Set<string>): DayProposal[] {
  if (!Array.isArray(rawAssignments)) return [];
  const seen = new Set<string>();
  const out: DayProposal[] = [];

  for (const entry of rawAssignments) {
    if (!entry || typeof entry !== "object") continue;
    const { id, day } = entry as { id?: unknown; day?: unknown };
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 7) continue;
    seen.add(id);
    out.push({ id, day });
  }

  return out;
}
