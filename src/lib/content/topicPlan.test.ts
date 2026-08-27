import { describe, it, expect } from "vitest";
import { normalizeTopicAssignments, MAX_TOPICS_PER_ITEM } from "./topicPlan";

const IDS = new Set(["a", "b", "c"]);
const SLUGS = new Set(["addiction", "divorce", "grief", "anxiety", "purpose", "relationships", "identity-loss", "redundancy"]);

describe("normalizeTopicAssignments", () => {
  it("keeps valid ids with valid, de-duplicated slugs", () => {
    const out = normalizeTopicAssignments(
      [
        { id: "a", topicSlugs: ["addiction", "grief"] },
        { id: "b", topicSlugs: ["divorce", "divorce"] },
      ],
      IDS,
      SLUGS
    );
    expect(out.get("a")).toEqual(["addiction", "grief"]);
    expect(out.get("b")).toEqual(["divorce"]);
  });

  it("lowercases and trims slugs before validating", () => {
    const out = normalizeTopicAssignments([{ id: "a", topicSlugs: [" Addiction ", "GRIEF"] }], IDS, SLUGS);
    expect(out.get("a")).toEqual(["addiction", "grief"]);
  });

  it("drops unknown ids and unknown slugs", () => {
    const out = normalizeTopicAssignments(
      [
        { id: "zzz", topicSlugs: ["grief"] },
        { id: "a", topicSlugs: ["grief", "not-a-topic", ""] },
      ],
      IDS,
      SLUGS
    );
    expect(out.has("zzz")).toBe(false);
    expect(out.get("a")).toEqual(["grief"]);
  });

  it("omits items whose topics all resolve to nothing (0 topics is valid)", () => {
    const out = normalizeTopicAssignments(
      [
        { id: "a", topicSlugs: ["not-a-topic"] },
        { id: "b", topicSlugs: [] },
      ],
      IDS,
      SLUGS
    );
    expect(out.has("a")).toBe(false);
    expect(out.has("b")).toBe(false);
    expect(out.size).toBe(0);
  });

  it("keeps only the first assignment for a duplicated id", () => {
    const out = normalizeTopicAssignments(
      [
        { id: "a", topicSlugs: ["grief"] },
        { id: "a", topicSlugs: ["addiction"] },
      ],
      IDS,
      SLUGS
    );
    expect(out.get("a")).toEqual(["grief"]);
  });

  it("caps topics per item", () => {
    const out = normalizeTopicAssignments(
      [{ id: "a", topicSlugs: ["addiction", "divorce", "grief", "anxiety", "purpose"] }],
      IDS,
      SLUGS
    );
    expect(out.get("a")).toHaveLength(MAX_TOPICS_PER_ITEM);
  });

  it("returns an empty map for non-array / malformed input", () => {
    expect(normalizeTopicAssignments(null, IDS, SLUGS).size).toBe(0);
    expect(normalizeTopicAssignments("nope", IDS, SLUGS).size).toBe(0);
    expect(normalizeTopicAssignments([null, 3, "x", { id: "a", topicSlugs: "grief" }], IDS, SLUGS).size).toBe(0);
  });
});
