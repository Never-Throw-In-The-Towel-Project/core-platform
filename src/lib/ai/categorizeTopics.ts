import "server-only";
import { AI_MODEL, createAiClient, isAiConfigured } from "./client";
import { normalizeTopicAssignments } from "@/lib/content/topicPlan";

/**
 * Tag each content item with 0..N member-facing TOPICS (the life situations the
 * Library browses by — Addiction, Divorce, Grief, …), in one batched model call.
 * Mirrors lib/ai/categorizeVideos.ts: structured output constrained to our exact
 * ids and the LIVE topic slugs (topics are editable, so the caller passes the
 * current taxonomy — never hardcode it), defensive normalisation, and a graceful
 * no-op when ANTHROPIC_API_KEY isn't set.
 *
 * Precision over recall: an item with no clear situation gets no topic. There is
 * no default — zero topics is a valid, common outcome.
 */

export interface TopicInputItem {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
}

function buildSchema(ids: string[], slugs: string[]) {
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
            topicSlugs: { type: "array", items: { type: "string", enum: slugs } },
          },
          required: ["id", "topicSlugs"],
        },
      },
    },
    required: ["assignments"],
  } as const;
}

/**
 * Returns a map id → topic slugs for the items the model tagged. Empty map when
 * AI isn't configured, no topics exist, or the call yields nothing usable.
 */
export async function categorizeTopics(
  items: TopicInputItem[],
  topics: { slug: string; label: string }[]
): Promise<Map<string, string[]>> {
  if (items.length === 0 || topics.length === 0 || !isAiConfigured()) return new Map();

  const client = createAiClient();
  const ids = items.map((i) => i.id);
  const slugs = topics.map((t) => t.slug);

  const topicLines = topics.map((t) => `- ${t.slug}: ${t.label}`).join("\n");
  const system = [
    "You tag wellbeing content for NTITT, a men's mental-health platform, by the",
    "life situations it speaks to. Assign each item ZERO OR MORE topics from this",
    "fixed list — always use the slug on the left:",
    "",
    topicLines,
    "",
    "Rules:",
    "- Only assign a topic when the content is genuinely about that situation.",
    "  Precision over recall: most items have 0–2 topics, and content that doesn't",
    "  fit any (a plain workout, a recipe, generic motivation) should get NONE.",
    "  Never force a topic on unrelated content.",
    "- Return exactly one assignment object per item you were given: its id and a",
    "  topicSlugs array (empty when nothing fits).",
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
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema(ids, slugs) } },
    messages: [{ role: "user", content: `Content to tag (${items.length}):\n${itemLines}` }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return new Map();

  const raw = JSON.parse(textBlock.text) as { assignments?: unknown };
  return normalizeTopicAssignments(raw.assignments, new Set(ids), new Set(slugs));
}
