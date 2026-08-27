/**
 * Pure helpers for turning the AI's topic suggestions into concrete assignments —
 * no I/O, no `server-only`, so the normalisation is unit-testable. The
 * server-only AI transport (lib/ai/categorizeTopics.ts) calls the model; this
 * module validates what comes back.
 *
 * Unlike the video-category planner, topics are a MANY-TO-MANY facet: an item
 * gets 0..N topics and there is deliberately NO default fallback — a plain
 * workout or recipe legitimately maps to none, and forcing a life-situation
 * topic onto unrelated content would be wrong.
 */

// A single item rarely fits more than a few life-situations; cap so a stray
// over-eager classification can't smear an item across every room.
export const MAX_TOPICS_PER_ITEM = 4;

/**
 * Defensive normalisation of the model's raw assignments: keep only entries that
 * reference an id we asked about (first one wins) and only topic slugs from the
 * live taxonomy; dedup and cap. Items the model returns with no valid topic are
 * simply absent from the map (nothing to tag). Returns a map id → topic slugs.
 */
export function normalizeTopicAssignments(
  rawAssignments: unknown,
  validIds: Set<string>,
  validSlugs: Set<string>
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!Array.isArray(rawAssignments)) return out;

  for (const entry of rawAssignments) {
    if (!entry || typeof entry !== "object") continue;
    const { id, topicSlugs } = entry as { id?: unknown; topicSlugs?: unknown };
    if (typeof id !== "string" || !validIds.has(id) || out.has(id)) continue;
    if (!Array.isArray(topicSlugs)) continue;

    const clean = Array.from(
      new Set(
        topicSlugs
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => validSlugs.has(s))
      )
    ).slice(0, MAX_TOPICS_PER_ITEM);

    if (clean.length > 0) out.set(id, clean);
  }

  return out;
}
