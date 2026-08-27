import "server-only";
import { AI_MODEL, createAiClient, isAiConfigured } from "./client";
import { normalizeTopicAssignments } from "@/lib/content/topicPlan";
import { STAGE_KEYS, STAGE_META } from "@/lib/content/stageConfig";
import type { ContentStage } from "@/types/database";

/**
 * Tag each content item with 0..N journey STAGES — the Library's "Where you are"
 * facet (Start here / In it / Rebuilding) — in one batched model call. Mirrors
 * categorizeTopics, but the stage set is FIXED (STAGE_KEYS), so it's hardcoded
 * into the schema rather than passed in.
 *
 * Precision over recall: most items fit ONE stage; a piece that isn't clearly
 * for any journey moment (a plain workout, a recipe) gets none. Reuses the same
 * tested assignment normaliser as topics.
 */

export interface StageInputItem {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
}

function buildSchema(ids: string[]) {
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
            stages: { type: "array", items: { type: "string", enum: [...STAGE_KEYS] } },
          },
          required: ["id", "stages"],
        },
      },
    },
    required: ["assignments"],
  } as const;
}

export async function categorizeStages(items: StageInputItem[]): Promise<Map<string, ContentStage[]>> {
  if (items.length === 0 || !isAiConfigured()) return new Map();

  const client = createAiClient();
  const ids = items.map((i) => i.id);

  const stageLines = STAGE_KEYS.map((k) => `- ${k}: ${STAGE_META[k].label} — ${STAGE_META[k].blurb}`).join("\n");
  const system = [
    "You tag wellbeing content for NTITT, a men's mental-health platform, by WHERE",
    "a member is in their journey. Assign each item ZERO OR MORE stages from this",
    "fixed list — always use the key on the left:",
    "",
    stageLines,
    "",
    "Rules:",
    "- Assign a stage only when the content clearly speaks to that moment. Precision",
    "  over recall: MOST items have exactly one stage, and content that fits no",
    "  particular journey moment (a plain workout, a recipe, generic motivation)",
    "  should get NONE. Never force a stage on unrelated content.",
    "- start_here is for orienting, foundational pieces; in_it for being in the",
    "  thick of a hard time; rebuilding for finding your feet again afterwards.",
    "- Return exactly one assignment object per item you were given: its id and a",
    "  stages array (empty when nothing fits).",
  ].join("\n");

  const itemLines = items
    .map(
      (i) =>
        `- id: ${i.id}\n  title: ${i.title || "(untitled)"}\n  summary: ${
          i.summary?.trim() || "(none)"
        }\n  tags: ${i.tags.length > 0 ? i.tags.join(", ") : "(none)"}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    system,
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema(ids) } },
    messages: [{ role: "user", content: `Content to tag (${items.length}):\n${itemLines}` }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return new Map();

  const raw = JSON.parse(textBlock.text) as { assignments?: unknown };
  // Reuse the tested topic normaliser: it validates ids + values, dedupes and
  // caps. Its per-item shape is { id, topicSlugs }, so remap `stages` → that key;
  // the values are validated against STAGE_KEYS, so the result is stage keys.
  const remapped = Array.isArray(raw.assignments)
    ? (raw.assignments as { id?: unknown; stages?: unknown }[]).map((a) => ({ id: a?.id, topicSlugs: a?.stages }))
    : raw.assignments;
  return normalizeTopicAssignments(remapped, new Set(ids), new Set(STAGE_KEYS)) as Map<string, ContentStage[]>;
}
