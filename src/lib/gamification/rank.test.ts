import { describe, it, expect } from "vitest";
import { resolveRank, displayRankName } from "./rank";

describe("resolveRank", () => {
  it("returns the canonical, confirmed Contender under 30 active days", () => {
    expect(resolveRank(0)).toEqual({ name: "Contender", confirmed: true });
    expect(resolveRank(29)).toEqual({ name: "Contender", confirmed: true });
  });

  it("returns provisional (unconfirmed) tiers at the 30- and 90-day milestones", () => {
    expect(resolveRank(30).confirmed).toBe(false);
    expect(resolveRank(90).confirmed).toBe(false);
  });
});

describe("displayRankName", () => {
  it("shows a confirmed name as-is", () => {
    expect(displayRankName({ name: "Contender", confirmed: true })).toBe("Contender");
  });

  it("never shows an unconfirmed (not-yet-signed-off) name — falls back to Contender", () => {
    expect(displayRankName({ name: "Challenger", confirmed: false })).toBe("Contender");
    expect(displayRankName({ name: "Cornerman", confirmed: false })).toBe("Contender");
  });
});
