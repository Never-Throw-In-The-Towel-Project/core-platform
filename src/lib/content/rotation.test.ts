import { describe, it, expect } from "vitest";
import { rotateForWeek, isoWeekdayFromName, DAY_LABEL } from "./rotation";

describe("rotateForWeek", () => {
  it("returns items unchanged for 0 or 1 items", () => {
    expect(rotateForWeek([], 5)).toEqual([]);
    expect(rotateForWeek(["a"], 5)).toEqual(["a"]);
  });

  it("leads with a different item each successive week, wrapping around", () => {
    const bank = ["a", "b", "c", "d"];
    expect(rotateForWeek(bank, 1)[0]).toBe("a"); // (1-1) % 4 = 0
    expect(rotateForWeek(bank, 2)[0]).toBe("b");
    expect(rotateForWeek(bank, 3)[0]).toBe("c");
    expect(rotateForWeek(bank, 4)[0]).toBe("d");
    expect(rotateForWeek(bank, 5)[0]).toBe("a"); // wraps back to the top
  });

  it("is always a permutation of the bank (loses nothing)", () => {
    const bank = ["a", "b", "c"];
    expect([...rotateForWeek(bank, 7)].sort()).toEqual(["a", "b", "c"]);
  });

  it("is stable within the same week", () => {
    const bank = ["a", "b", "c"];
    expect(rotateForWeek(bank, 9)).toEqual(rotateForWeek(bank, 9));
  });
});

describe("isoWeekdayFromName", () => {
  it("maps weekday names to ISO 1..7 and back to a label", () => {
    expect(isoWeekdayFromName("monday")).toBe(1);
    expect(isoWeekdayFromName("sunday")).toBe(7);
    expect(DAY_LABEL[isoWeekdayFromName("wednesday")]).toBe("Wednesday");
  });
});
