import "server-only";
import { AI_MODEL, createAiClient } from "./client";
import type { VideoCategory } from "@/types/database";

// Assistive content tagging: given a piece's title + summary, suggest the theme,
// an optional day-of-week, and a few tags for the Super Admin to confirm or edit
// in the Studio. Never auto-applied, never auto-published -- the admin is always
// the one who commits (docs/CONTENT_PLATFORM_STRATEGY.md "assistive-with-confirm").

const CATEGORIES: VideoCategory[] = ["mental_fitness", "physical_fitness", "nutrition", "tools_tips"];

export interface TagSuggestion {
  category: VideoCategory;
  /** ISO weekday 1=Mon…7=Sun, or null for "any day" (not day-specific). */
  day_of_week: number | null;
  tags: string[];
  rationale: string;
}

// Structured-output JSON schema. Uses only the constrained keywords the API
// supports for structured outputs (type/enum/anyOf/null + additionalProperties:
// false) -- no min/max or length constraints, which aren't supported.
const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: CATEGORIES },
    day_of_week: {
      anyOf: [{ type: "integer", enum: [1, 2, 3, 4, 5, 6, 7] }, { type: "null" }],
    },
    tags: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
  },
  required: ["category", "day_of_week", "tags", "rationale"],
} as const;

const SYSTEM_PROMPT = [
  "You help the NTITT team tag wellbeing content for members. NTITT is a men's",
  "mental-health platform; content is organised on a Monday–Sunday framework.",
  "",
  "Given a piece's title and summary, suggest:",
  "- category (the theme): mental_fitness, physical_fitness, nutrition, or tools_tips.",
  "- day_of_week: an ISO weekday (1=Monday … 7=Sunday) ONLY when the piece is",
  "  genuinely day-specific (e.g. a workout suits Wednesday, a reflection suits",
  "  Sunday). Use null when it fits any day — most content does.",
  "- tags: 2–5 short lowercase topic tags a member might search (e.g. grief,",
  "  sleep, redundancy). No hashes, no duplicates of the theme.",
  "- rationale: one short sentence for the admin.",
  "",
  "These are suggestions a human will review and edit. Prefer null day_of_week",
  "when unsure; do not invent a specialism the title/summary doesn't support.",
].join("\n");

/**
 * Ask the model for a tag suggestion. Returns validated, normalised fields; the
 * caller (a server action) has already checked isAiConfigured() and gated on
 * ntitt_admin. Throws on transport/parse failure -- the action catches it.
 */
export async function suggestContentTags(title: string, summary: string): Promise<TagSuggestion> {
  const client = createAiClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    // Headroom so thinking + the JSON both fit: on the current Opus, max_tokens
    // caps thinking AND output together, and thinking is on by default. 2048 is
    // ample for a small tag object while staying cheap.
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    // Low effort: this is a light extraction, not a reasoning task -- keeps it
    // fast and cheap. Structured outputs guarantee the JSON shape.
    output_config: { effort: "low", format: { type: "json_schema", schema: SUGGESTION_SCHEMA } },
    messages: [
      { role: "user", content: `Title: ${title}\n\nSummary: ${summary.trim() || "(none provided)"}` },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response contained no text block");
  }

  const raw = JSON.parse(textBlock.text) as Partial<TagSuggestion>;
  return normalise(raw);
}

/** Defensive normalisation: never trust the shape blindly, even with structured
 *  outputs. Clamp to the known category set, valid weekday range, and a handful
 *  of clean tags. */
function normalise(raw: Partial<TagSuggestion>): TagSuggestion {
  const category = CATEGORIES.includes(raw.category as VideoCategory)
    ? (raw.category as VideoCategory)
    : "mental_fitness";

  const day =
    typeof raw.day_of_week === "number" && raw.day_of_week >= 1 && raw.day_of_week <= 7
      ? Math.trunc(raw.day_of_week)
      : null;

  const tags = Array.isArray(raw.tags)
    ? Array.from(
        new Set(
          raw.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
            .filter((t) => t.length > 0 && t.length <= 40)
        )
      ).slice(0, 6)
    : [];

  const rationale = typeof raw.rationale === "string" ? raw.rationale.trim().slice(0, 300) : "";

  return { category, day_of_week: day, tags, rationale };
}
