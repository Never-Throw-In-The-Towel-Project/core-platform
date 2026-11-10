import { describe, it, expect } from "vitest";
import { summariseWeekdays, formatRoutineTime } from "./userRoutinesConfig";

describe("summariseWeekdays", () => {
  it("collapses the common sets to friendly labels", () => {
    expect(summariseWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(summariseWeekdays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(summariseWeekdays([6, 7])).toBe("Weekends");
  });

  it("lists an arbitrary subset in week order, regardless of input order", () => {
    expect(summariseWeekdays([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(summariseWeekdays([7])).toBe("Sun");
  });

  it("does not treat Mon-Fri plus a weekend day as 'Weekdays'", () => {
    expect(summariseWeekdays([1, 2, 3, 4, 5, 6])).toBe("Mon, Tue, Wed, Thu, Fri, Sat");
  });
});

describe("formatRoutineTime", () => {
  it("trims a stored time to HH:MM, and passes null/empty through", () => {
    expect(formatRoutineTime("07:00:00")).toBe("07:00");
    expect(formatRoutineTime("07:30")).toBe("07:30");
    expect(formatRoutineTime(null)).toBeNull();
    expect(formatRoutineTime("")).toBeNull();
    expect(formatRoutineTime(undefined)).toBeNull();
  });
});
