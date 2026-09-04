import { describe, it, expect } from "vitest";
import { STAGE_KEYS, STAGE_META, isContentStage } from "./stageConfig";

// The "Where you are" stages are a FIXED, closed set (no taxonomy table), so the
// config and its URL guard are the contract the Library page and the AI tagging
// both depend on. These guard the invariants that keep the /content?stage= filter
// and the stage pills honest.
describe("isContentStage", () => {
  it("accepts each of the three known stage keys", () => {
    for (const key of STAGE_KEYS) {
      expect(isContentStage(key)).toBe(true);
    }
  });

  it("rejects unknown strings, so a bogus ?stage= param falls back to unfiltered", () => {
    expect(isContentStage("rebuild")).toBe(false); // near-miss of "rebuilding"
    expect(isContentStage("START_HERE")).toBe(false); // case-sensitive
    expect(isContentStage("")).toBe(false);
    expect(isContentStage("all")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isContentStage(undefined)).toBe(false);
    expect(isContentStage(null)).toBe(false);
    expect(isContentStage(123)).toBe(false);
    expect(isContentStage(["start_here"])).toBe(false);
  });
});

describe("STAGE_META", () => {
  it("has exactly one entry per stage key and no orphans", () => {
    expect(Object.keys(STAGE_META).sort()).toEqual([...STAGE_KEYS].sort());
  });

  it("gives every stage a non-empty label and blurb", () => {
    for (const key of STAGE_KEYS) {
      expect(STAGE_META[key].label.trim().length).toBeGreaterThan(0);
      expect(STAGE_META[key].blurb.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the fixed journey order (the filter-pill display order)", () => {
    expect(STAGE_KEYS).toEqual(["start_here", "in_it", "rebuilding"]);
  });
});
