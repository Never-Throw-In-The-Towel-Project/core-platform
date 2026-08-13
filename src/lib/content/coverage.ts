import type { ContentItem, VideoCategory } from "@/types/database";

// Deterministic gap detection for the Content Studio -- the reliable half of the
// "AI brain" (docs/CONTENT_PLATFORM_STRATEGY.md "Pillar 5"). Counting is
// arithmetic, so it lives in code, not in an LLM: pure, exact, unit-tested, and
// works with no API key. The AI layer handles judgment (tagging); this handles
// the maths of what's thin.

const ALL_CATEGORIES: VideoCategory[] = ["mental_fitness", "physical_fitness", "nutrition", "tools_tips"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export interface CoverageGaps {
  /** Published items only -- gaps are about what MEMBERS can actually see. */
  totalPublished: number;
  perDay: { day: number; count: number }[];
  perTheme: { theme: VideoCategory; count: number }[];
  /** ISO weekdays (1..7) with no day-tagged published content. */
  emptyDays: number[];
  /** Themes with no published content. */
  emptyThemes: VideoCategory[];
}

/**
 * Summarise how published content is spread across the Mon–Sun days and the
 * four themes, and flag the empties. Drafts are excluded: a draft isn't a gap
 * that's filled, it's a gap in progress. Pure -- no I/O.
 */
export function computeCoverageGaps(items: ContentItem[]): CoverageGaps {
  const published = items.filter((item) => item.is_published);

  const dayCounts = new Map<number, number>(WEEKDAYS.map((d) => [d, 0]));
  for (const item of published) {
    if (item.day_of_week != null && dayCounts.has(item.day_of_week)) {
      dayCounts.set(item.day_of_week, (dayCounts.get(item.day_of_week) ?? 0) + 1);
    }
  }

  const themeCounts = new Map<VideoCategory, number>(ALL_CATEGORIES.map((c) => [c, 0]));
  for (const item of published) {
    themeCounts.set(item.category, (themeCounts.get(item.category) ?? 0) + 1);
  }

  return {
    totalPublished: published.length,
    perDay: WEEKDAYS.map((day) => ({ day, count: dayCounts.get(day) ?? 0 })),
    perTheme: ALL_CATEGORIES.map((theme) => ({ theme, count: themeCounts.get(theme) ?? 0 })),
    emptyDays: WEEKDAYS.filter((day) => (dayCounts.get(day) ?? 0) === 0),
    emptyThemes: ALL_CATEGORIES.filter((theme) => (themeCounts.get(theme) ?? 0) === 0),
  };
}
