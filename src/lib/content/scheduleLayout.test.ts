import { describe, it, expect } from "vitest";
import { layOutSchedule } from "./scheduleLayout";

// Base 2026-08-16 is a Sunday (Aug 1 2026 is a Saturday).
const BASE = "2026-08-16";

describe("layOutSchedule", () => {
  it("places a weekday item on the next occurrence of that weekday", () => {
    // Monday → Aug 17; Wednesday → Aug 19; Sunday (== base) → Aug 16.
    const out = layOutSchedule(
      [
        { id: "mon", day: 1 },
        { id: "wed", day: 3 },
        { id: "sun", day: 7 },
      ],
      BASE
    );
    expect(out.find((o) => o.id === "mon")?.date).toBe("2026-08-17");
    expect(out.find((o) => o.id === "wed")?.date).toBe("2026-08-19");
    expect(out.find((o) => o.id === "sun")?.date).toBe("2026-08-16");
  });

  it("rolls same-weekday items onto successive weeks", () => {
    const out = layOutSchedule(
      [
        { id: "a", day: 1 },
        { id: "b", day: 1 },
        { id: "c", day: 1 },
      ],
      BASE
    );
    expect(out.map((o) => o.date)).toEqual(["2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("fills 'Any day' items on successive days from base", () => {
    const out = layOutSchedule(
      [
        { id: "x", day: 0 },
        { id: "y", day: 0 },
        { id: "z", day: 0 },
      ],
      BASE
    );
    expect(out.map((o) => o.date)).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
  });

  it("crosses month boundaries correctly", () => {
    // Fifth Monday from a base whose first Monday is Aug 17 → Sep 14.
    const out = layOutSchedule(
      Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, day: 1 })),
      BASE
    );
    expect(out.at(-1)?.date).toBe("2026-09-14");
  });
});
