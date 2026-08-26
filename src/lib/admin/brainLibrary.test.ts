import { describe, it, expect } from "vitest";
import type { ContentItem } from "@/types/database";
import {
  EMPTY_FILTER,
  filterBrainItems,
  isFilterActive,
  sortBrainItems,
  summarizeBrainItems,
} from "./brainLibrary";

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: over.id ?? "id",
    type: "video",
    title: "Title",
    summary: null,
    category: "mental_fitness",
    day_of_week: null,
    vimeo_id: null,
    vimeo_hash: null,
    asset_path: null,
    external_url: null,
    thumbnail_url: null,
    tags: [],
    workout_tier: null,
    duration_seconds: null,
    is_published: false,
    created_by: null,
    folder_id: null,
    scheduled_for: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("filterBrainItems", () => {
  const items = [
    item({ id: "a", title: "Walking basics", type: "video", is_published: true, category: "physical_fitness", day_of_week: 3, tags: ["walking"] }),
    item({ id: "b", title: "Grief", type: "text", is_published: false, category: "mental_fitness", summary: "loss and grief" }),
    item({ id: "c", title: "Nutrition PDF", type: "document", is_published: true, category: "nutrition" }),
  ];

  it("matches search across title, summary and tags", () => {
    expect(filterBrainItems(items, { ...EMPTY_FILTER, search: "walk" }).map((i) => i.id)).toEqual(["a"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, search: "grief" }).map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by type, status, category and day", () => {
    expect(filterBrainItems(items, { ...EMPTY_FILTER, types: ["video"] }).map((i) => i.id)).toEqual(["a"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, status: "draft" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, categories: ["nutrition"] }).map((i) => i.id)).toEqual(["c"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, day: 3 }).map((i) => i.id)).toEqual(["a"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, day: "agnostic" }).map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("combines filters (AND)", () => {
    expect(
      filterBrainItems(items, { ...EMPTY_FILTER, types: ["video"], status: "live" }).map((i) => i.id)
    ).toEqual(["a"]);
    expect(filterBrainItems(items, { ...EMPTY_FILTER, types: ["video"], status: "draft" })).toEqual([]);
  });
});

describe("sortBrainItems", () => {
  const items = [
    item({ id: "old", title: "Beta", created_at: "2026-01-01T00:00:00Z" }),
    item({ id: "new", title: "Alpha", created_at: "2026-03-01T00:00:00Z" }),
  ];
  it("sorts newest, oldest and by title, without mutating input", () => {
    expect(sortBrainItems(items, "newest").map((i) => i.id)).toEqual(["new", "old"]);
    expect(sortBrainItems(items, "oldest").map((i) => i.id)).toEqual(["old", "new"]);
    expect(sortBrainItems(items, "title").map((i) => i.id)).toEqual(["new", "old"]); // Alpha before Beta
    expect(items[0].id).toBe("old"); // input untouched
  });
});

describe("summarizeBrainItems", () => {
  it("counts total, live/draft, unfiled and by type", () => {
    const stats = summarizeBrainItems([
      item({ is_published: true, folder_id: "f1", type: "video" }),
      item({ is_published: false, folder_id: null, type: "text" }),
      item({ is_published: true, folder_id: null, type: "video" }),
    ]);
    expect(stats).toEqual({
      total: 3,
      live: 2,
      draft: 1,
      unfiled: 2,
      byType: { video: 2, document: 0, image: 0, text: 1 },
    });
  });
});

describe("isFilterActive", () => {
  it("is false for the empty filter, true once anything narrows", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, search: "x" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, status: "live" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, day: 2 })).toBe(true);
  });
});
