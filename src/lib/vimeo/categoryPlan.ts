import type { VideoCategory } from "@/types/database";

/**
 * Pure helpers for turning the AI's category suggestions into a concrete plan —
 * no I/O, no `server-only`, so the normalisation + fallback logic is unit-
 * testable. The server-only AI transport (lib/ai/categorizeVideos.ts) calls the
 * model; this module validates what comes back and guarantees every video ends
 * up with a real category (the Library groups by it, and the column is NOT NULL).
 */

export const VIDEO_CATEGORIES: readonly VideoCategory[] = [
  "mental_fitness",
  "physical_fitness",
  "nutrition",
  "tools_tips",
];

/**
 * Where a video lands when the AI is unavailable or unsure. NTITT is a men's
 * mental-health platform, so its core theme is the least-surprising home; the
 * operator can always re-tag afterwards.
 */
export const DEFAULT_VIDEO_CATEGORY: VideoCategory = "mental_fitness";

function isVideoCategory(value: unknown): value is VideoCategory {
  return typeof value === "string" && (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

export interface CategoryAssignment {
  category: VideoCategory;
  tags: string[];
}

/**
 * Defensive normalisation of the model's raw assignments: keep only entries that
 * reference an id we asked about (first one wins) and carry a valid category;
 * clean the tags with the same hygiene as the tagger. Returns a map keyed by id.
 */
export function normalizeCategoryAssignments(
  rawAssignments: unknown,
  validIds: Set<string>
): Map<string, CategoryAssignment> {
  const out = new Map<string, CategoryAssignment>();
  if (!Array.isArray(rawAssignments)) return out;

  for (const entry of rawAssignments) {
    if (!entry || typeof entry !== "object") continue;
    const { id, category, tags } = entry as { id?: unknown; category?: unknown; tags?: unknown };
    if (typeof id !== "string" || !validIds.has(id) || out.has(id)) continue;
    if (!isVideoCategory(category)) continue;

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

    out.set(id, { category, tags: cleanTags });
  }

  return out;
}

/**
 * Resolve the final category + tags for one video: the AI's assignment when it
 * gave a valid one, otherwise the default category with no tags. Guarantees a
 * usable result for every video so a sync never fails the NOT NULL category.
 */
export function resolveCategory(
  id: string,
  plan: Map<string, CategoryAssignment>
): CategoryAssignment {
  return plan.get(id) ?? { category: DEFAULT_VIDEO_CATEGORY, tags: [] };
}
