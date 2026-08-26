import { describe, it, expect } from "vitest";
import {
  DEFAULT_VIDEO_CATEGORY,
  normalizeCategoryAssignments,
  resolveCategory,
} from "./categoryPlan";

describe("normalizeCategoryAssignments", () => {
  const ids = new Set(["1", "2", "3"]);

  it("keeps valid assignments and cleans their tags", () => {
    const plan = normalizeCategoryAssignments(
      [{ id: "1", category: "nutrition", tags: ["#Food", "food", " Hydration "] }],
      ids
    );
    expect(plan.get("1")).toEqual({ category: "nutrition", tags: ["food", "hydration"] });
  });

  it("drops entries with an unknown id, a bad category, or duplicate id", () => {
    const plan = normalizeCategoryAssignments(
      [
        { id: "999", category: "nutrition", tags: [] }, // unknown id
        { id: "2", category: "not_a_category", tags: [] }, // bad category
        { id: "3", category: "physical_fitness", tags: [] },
        { id: "3", category: "nutrition", tags: [] }, // duplicate — first wins
      ],
      ids
    );
    expect(plan.has("999")).toBe(false);
    expect(plan.has("2")).toBe(false);
    expect(plan.get("3")).toEqual({ category: "physical_fitness", tags: [] });
  });

  it("returns an empty map for non-array input", () => {
    expect(normalizeCategoryAssignments(null, ids).size).toBe(0);
    expect(normalizeCategoryAssignments({ nope: true }, ids).size).toBe(0);
  });
});

describe("resolveCategory", () => {
  it("uses the AI assignment when present", () => {
    const plan = new Map([["1", { category: "tools_tips" as const, tags: ["budget"] }]]);
    expect(resolveCategory("1", plan)).toEqual({ category: "tools_tips", tags: ["budget"] });
  });

  it("falls back to the default category with no tags when the id is missing", () => {
    expect(resolveCategory("missing", new Map())).toEqual({
      category: DEFAULT_VIDEO_CATEGORY,
      tags: [],
    });
  });
});
