import { describe, it, expect } from "vitest";
import { computeCoverageGaps } from "./coverage";
import type { ContentItem } from "@/types/database";

// Minimal factory -- only the fields computeCoverageGaps reads (category,
// day_of_week, is_published) vary; the rest are representative filler.
function item(
  overrides: Partial<Pick<ContentItem, "category" | "day_of_week" | "is_published">> & { id: string }
): ContentItem {
  return {
    type: "video",
    title: overrides.id,
    summary: null,
    category: overrides.category ?? "mental_fitness",
    day_of_week: overrides.day_of_week ?? null,
    vimeo_id: "v",
    vimeo_hash: null,
    asset_path: null,
    external_url: null,
    thumbnail_url: null,
    tags: [],
    workout_tier: null,
    duration_seconds: null,
    is_published: overrides.is_published ?? true,
    created_by: null,
    folder_id: null,
    scheduled_for: null,
    created_at: "2026-08-13T00:00:00Z",
    ...overrides,
  };
}

describe("computeCoverageGaps", () => {
  it("reports every day and theme empty for an empty library", () => {
    const g = computeCoverageGaps([]);
    expect(g.totalPublished).toBe(0);
    expect(g.emptyDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(g.emptyThemes).toEqual(["mental_fitness", "physical_fitness", "nutrition", "tools_tips"]);
    expect(g.perDay).toHaveLength(7);
    expect(g.perTheme).toHaveLength(4);
  });

  it("counts only published items", () => {
    const g = computeCoverageGaps([
      item({ id: "a", is_published: true, day_of_week: 3, category: "physical_fitness" }),
      item({ id: "b", is_published: false, day_of_week: 4, category: "nutrition" }),
    ]);
    expect(g.totalPublished).toBe(1);
    // the draft's Thursday + nutrition do NOT fill their gaps
    expect(g.emptyDays).toContain(4);
    expect(g.emptyThemes).toContain("nutrition");
    expect(g.emptyDays).not.toContain(3);
    expect(g.perTheme.find((t) => t.theme === "physical_fitness")?.count).toBe(1);
  });

  it("a day-agnostic (null day) published item fills no weekday", () => {
    const g = computeCoverageGaps([item({ id: "a", day_of_week: null, category: "tools_tips" })]);
    expect(g.emptyDays).toEqual([1, 2, 3, 4, 5, 6, 7]); // no specific weekday covered
    expect(g.emptyThemes).not.toContain("tools_tips"); // but the theme is covered
  });

  it("tallies per-day and per-theme counts", () => {
    const g = computeCoverageGaps([
      item({ id: "a", day_of_week: 1, category: "mental_fitness" }),
      item({ id: "b", day_of_week: 1, category: "mental_fitness" }),
      item({ id: "c", day_of_week: 3, category: "physical_fitness" }),
    ]);
    expect(g.perDay.find((d) => d.day === 1)?.count).toBe(2);
    expect(g.perDay.find((d) => d.day === 3)?.count).toBe(1);
    expect(g.perTheme.find((t) => t.theme === "mental_fitness")?.count).toBe(2);
    expect(g.emptyDays).toEqual([2, 4, 5, 6, 7]);
    expect(g.emptyThemes).toEqual(["nutrition", "tools_tips"]);
  });

  it("does not mutate the input", () => {
    const items: ContentItem[] = [item({ id: "a", day_of_week: 2 })];
    const snapshot = JSON.parse(JSON.stringify(items));
    computeCoverageGaps(items);
    expect(items).toEqual(snapshot);
  });
});
