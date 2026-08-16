import { describe, it, expect } from "vitest";
import { isVisibleOnChannel } from "./channelVisibility";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

describe("isVisibleOnChannel", () => {
  it("'all' shows everything", () => {
    expect(isVisibleOnChannel(undefined, "all")).toBe(true);
    expect(isVisibleOnChannel(new Set([A]), "all")).toBe(true);
  });

  it("'global' shows only items with no placements", () => {
    expect(isVisibleOnChannel(undefined, "global")).toBe(true);
    expect(isVisibleOnChannel(new Set(), "global")).toBe(true);
    expect(isVisibleOnChannel(new Set([A]), "global")).toBe(false);
  });

  it("a company sees global items plus items targeted to it", () => {
    // Global → visible on company A.
    expect(isVisibleOnChannel(undefined, A)).toBe(true);
    // Targeted to A → visible on A.
    expect(isVisibleOnChannel(new Set([A]), A)).toBe(true);
    // Targeted only to B → hidden from A.
    expect(isVisibleOnChannel(new Set([B]), A)).toBe(false);
    // Targeted to both → visible on A.
    expect(isVisibleOnChannel(new Set([A, B]), A)).toBe(true);
  });
});
