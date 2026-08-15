import "server-only";
import { AI_MODEL, createAiClient } from "./client";

// Assistive BATCH organisation for the Brain: given a set of content items and
// the existing folder names, propose a folder + refined tags for each item, so
// the Super Admin can sort a pile of freshly-added content in one review instead
// of one item at a time. Like suggestContentTags, this is
// assistive-with-confirm: it only ever PROPOSES — the admin reviews the plan and
// nothing is written until they apply it (docs/CONTENT_PLATFORM_STRATEGY.md).

export interface OrganizationProposal {
  id: string;
  /** An existing folder name, or a concise new one the model invented. */
  folder: string;
  tags: string[];
}

export interface OrganizeInputItem {
  id: string;
  title: string;
  summary: string | null;
  type: string;
  tags: string[];
}

function buildSchema(ids: string[]) {
  // `id` is constrained to the exact input set via enum, so the model can only
  // ever reference items we sent it — a hard guardrail on top of the id-set
  // filter in normalise(). Structured outputs support enum but not min/max/length.
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
            folder: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "folder", "tags"],
        },
      },
    },
    required: ["assignments"],
  } as const;
}

const SYSTEM_PROMPT = [
  "You help the NTITT team organise a knowledge base of wellbeing content. NTITT",
  "is a men's mental-health platform; content is grouped into folders and tagged",
  "so it can be found and served to the right member.",
  "",
  "You are given a batch of content items (title, summary, type, current tags) and",
  "the list of folders that already exist. For EVERY item, propose:",
  "- folder: the single best home for it. STRONGLY prefer an existing folder name",
  "  when one fits (copy it exactly). Only invent a new folder when nothing fits —",
  "  keep new names short and topic-based (Title Case, 1–3 words, e.g. 'Sleep',",
  "  'Grief & Loss', 'Nutrition Basics'). Reuse the same new name for related",
  "  items so they group together rather than each getting its own folder.",
  "- tags: 2–5 short lowercase topic tags a member might search (e.g. grief, sleep,",
  "  redundancy). Keep the item's good existing tags and add missing ones; drop",
  "  noise. No hashes, no duplicates.",
  "",
  "Return exactly one assignment per item you were given. This is a plan a human",
  "will review and edit before anything is applied — favour a small, sensible set",
  "of folders over many near-duplicates.",
].join("\n");

/**
 * Ask the model to propose folder + tags for a batch. Returns validated,
 * normalised proposals keyed to the input ids. The caller (a server action) has
 * already checked isAiConfigured() and gated on ntitt_admin, and caps the batch
 * size. Throws on transport/parse failure — the action catches it.
 */
export async function proposeContentOrganization(
  items: OrganizeInputItem[],
  existingFolders: string[]
): Promise<OrganizationProposal[]> {
  if (items.length === 0) return [];
  const client = createAiClient();
  const ids = items.map((i) => i.id);

  const itemLines = items
    .map(
      (i) =>
        `- id: ${i.id}\n  title: ${i.title}\n  type: ${i.type}\n  summary: ${
          i.summary?.trim() || "(none)"
        }\n  current tags: ${i.tags.length ? i.tags.join(", ") : "(none)"}`
    )
    .join("\n");
  const folderLine = existingFolders.length ? existingFolders.join(", ") : "(none yet)";

  const response = await client.messages.create({
    model: AI_MODEL,
    // A batch of up to ~40 small assignments plus thinking; generous but bounded.
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema(ids) } },
    messages: [
      {
        role: "user",
        content: `Existing folders: ${folderLine}\n\nItems to organise (${items.length}):\n${itemLines}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response contained no text block");
  }

  const raw = JSON.parse(textBlock.text) as { assignments?: unknown };
  return normalise(raw.assignments, new Set(ids));
}

/** Defensive normalisation: keep only assignments referencing a real input id
 *  (first one wins per id), trim the folder name, and clean the tags — the same
 *  tag hygiene as contentTags.normalise. */
function normalise(rawAssignments: unknown, validIds: Set<string>): OrganizationProposal[] {
  if (!Array.isArray(rawAssignments)) return [];
  const seen = new Set<string>();
  const out: OrganizationProposal[] = [];

  for (const entry of rawAssignments) {
    if (!entry || typeof entry !== "object") continue;
    const { id, folder, tags } = entry as { id?: unknown; folder?: unknown; tags?: unknown };
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
    if (typeof folder !== "string") continue;
    const folderName = folder.trim().slice(0, 80);
    if (folderName.length === 0) continue;

    const cleanTags = Array.isArray(tags)
      ? Array.from(
          new Set(
            tags
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
              .filter((t) => t.length > 0 && t.length <= 40)
          )
        ).slice(0, 6)
      : [];

    seen.add(id);
    out.push({ id, folder: folderName, tags: cleanTags });
  }

  return out;
}
