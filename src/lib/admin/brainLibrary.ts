import type { ContentItem, ContentType, VideoCategory } from "@/types/database";

/**
 * Pure filtering / sorting / counting for the Brain library console — no I/O, no
 * React, so the logic the redesigned client surface relies on is unit-testable in
 * isolation. The client component (components/admin/brain/BrainLibrary.tsx) holds
 * the filter state and calls these; the server page just hands over the items.
 */

export const TYPE_LABEL: Record<ContentType, string> = {
  video: "Video",
  document: "Document",
  image: "Image",
  text: "Text",
};

export const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/** Short weekday labels (1 = Mon … 7 = Sun) for the compact card + day filter. */
export const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export const CONTENT_TYPES: readonly ContentType[] = ["video", "document", "image", "text"];
export const VIDEO_CATEGORIES: readonly VideoCategory[] = [
  "mental_fitness",
  "physical_fitness",
  "nutrition",
  "tools_tips",
];

export type BrainSort = "newest" | "oldest" | "title";
export type BrainStatus = "all" | "live" | "draft";
/** "all" = any day, "agnostic" = day_of_week null, or a 1–7 weekday. */
export type BrainDay = "all" | "agnostic" | number;

export interface BrainFilter {
  search: string;
  /** Empty = all types. */
  types: ContentType[];
  status: BrainStatus;
  /** Empty = all categories. */
  categories: VideoCategory[];
  day: BrainDay;
}

export const EMPTY_FILTER: BrainFilter = {
  search: "",
  types: [],
  status: "all",
  categories: [],
  day: "all",
};

/** True when no filter is narrowing the set (used to show "clear" affordances). */
export function isFilterActive(f: BrainFilter): boolean {
  return (
    f.search.trim() !== "" ||
    f.types.length > 0 ||
    f.status !== "all" ||
    f.categories.length > 0 ||
    f.day !== "all"
  );
}

function matchesSearch(item: ContentItem, q: string): boolean {
  if (q === "") return true;
  const haystack = [item.title, item.summary ?? "", item.tags.join(" ")].join(" ").toLowerCase();
  return haystack.includes(q);
}

export function filterBrainItems(items: ContentItem[], filter: BrainFilter): ContentItem[] {
  const q = filter.search.trim().toLowerCase();
  return items.filter((item) => {
    if (!matchesSearch(item, q)) return false;
    if (filter.types.length > 0 && !filter.types.includes(item.type)) return false;
    if (filter.status === "live" && !item.is_published) return false;
    if (filter.status === "draft" && item.is_published) return false;
    if (filter.categories.length > 0 && !filter.categories.includes(item.category)) return false;
    if (filter.day === "agnostic" && item.day_of_week != null) return false;
    if (typeof filter.day === "number" && item.day_of_week !== filter.day) return false;
    return true;
  });
}

export function sortBrainItems(items: ContentItem[], sort: BrainSort): ContentItem[] {
  const copy = [...items];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    case "newest":
    default:
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export interface BrainStats {
  total: number;
  live: number;
  draft: number;
  unfiled: number;
  byType: Record<ContentType, number>;
}

export function summarizeBrainItems(items: ContentItem[]): BrainStats {
  const byType: Record<ContentType, number> = { video: 0, document: 0, image: 0, text: 0 };
  let live = 0;
  let unfiled = 0;
  for (const item of items) {
    byType[item.type] += 1;
    if (item.is_published) live += 1;
    if (!item.folder_id) unfiled += 1;
  }
  return { total: items.length, live, draft: items.length - live, unfiled, byType };
}
