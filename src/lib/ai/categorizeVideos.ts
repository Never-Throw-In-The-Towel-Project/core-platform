import "server-only";
import { AI_MODEL, createAiClient, isAiConfigured } from "./client";
import {
  VIDEO_CATEGORIES,
  normalizeCategoryAssignments,
  type CategoryAssignment,
} from "@/lib/vimeo/categoryPlan";

/**
 * Assign each Vimeo video a member-facing theme (the VideoCategory the Library
 * groups by) plus a few search tags, in one batched model call. Mirrors
 * lib/ai/organizeContent.ts: structured output constrained to our exact ids and
 * the four category values, defensive normalisation, and a graceful no-op when
 * ANTHROPIC_API_KEY isn't set (the caller then falls back to a default category,
 * so a sync still works with AI switched off).
 */

export interface CategorizeInputItem {
  id: string;
  name: string;
  description: string | null;
}

function buildSchema(ids: string[]) {
  // `id` and `category` are enum-constrained so the model can only ever return
  // an id we sent and one of the four real categories — a hard guardrail on top
  // of normalizeCategoryAssignments().
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
            category: { type: "string", enum: [...VIDEO_CATEGORIES] },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "category", "tags"],
        },
      },
    },
    required: ["assignments"],
  } as const;
}

const SYSTEM_PROMPT = [
  "You sort wellbeing videos for NTITT, a men's mental-health platform, into the",
  "four themes members browse by. For EVERY video, choose exactly one category:",
  "",
  "- mental_fitness: mindset, mental health, emotions, resilience, stress, talking,",
  "  relationships, purpose, sleep, addiction/recovery. This is the platform's core",
  "  theme — use it when a video is about the inner life rather than the body.",
  "- physical_fitness: exercise, workouts, training, movement, mobility, sport.",
  "- nutrition: food, diet, eating, hydration, supplements, cooking.",
  "- tools_tips: practical how-tos and life admin that don't fit the above",
  "  (finances, productivity, routines, using a technique or resource).",
  "",
  "Also give 2–5 short lowercase search tags a member might type (e.g. grief,",
  "sleep, redundancy). No hashes, no duplicates. When a video is ambiguous, pick",
  "the single best-fit category rather than guessing wildly — mental_fitness is the",
  "sensible default for anything clearly about wellbeing but hard to place.",
  "Return exactly one assignment per video you were given.",
].join("\n");

/**
 * Returns a map id → { category, tags } for the videos the model classified.
 * Empty map when AI isn't configured or the call yields nothing usable; the
 * caller applies a default for any id missing from the map.
 */
export async function categorizeVideos(
  items: CategorizeInputItem[]
): Promise<Map<string, CategoryAssignment>> {
  if (items.length === 0 || !isAiConfigured()) return new Map();

  const client = createAiClient();
  const ids = items.map((i) => i.id);
  const itemLines = items
    .map(
      (i) =>
        `- id: ${i.id}\n  title: ${i.name || "(untitled)"}\n  description: ${
          i.description?.trim() || "(none)"
        }`
    )
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema(ids) } },
    messages: [{ role: "user", content: `Videos to categorise (${items.length}):\n${itemLines}` }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return new Map();

  const raw = JSON.parse(textBlock.text) as { assignments?: unknown };
  return normalizeCategoryAssignments(raw.assignments, new Set(ids));
}
