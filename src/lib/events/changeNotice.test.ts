import { describe, it, expect } from "vitest";
import { eventChangeNotice, type EventSnapshot } from "./changeNotice";

const base: EventSnapshot = {
  starts_at: "2026-09-05T08:00:00.000Z",
  ends_at: "2026-09-05T11:00:00.000Z",
  location_name: "Gainford, Co Durham",
  location_url: null,
};

describe("eventChangeNotice", () => {
  it("returns null when nothing material changed", () => {
    expect(eventChangeNotice("Cold Plunge", base, { ...base })).toBeNull();
  });

  it("ignores empty-vs-null location as unchanged", () => {
    const before = { ...base, location_name: null, location_url: null };
    const after = { ...base, location_name: "", location_url: null };
    expect(eventChangeNotice("Cold Plunge", before, after)).toBeNull();
  });

  it("flags a start-time change as a time change", () => {
    const after = { ...base, starts_at: "2026-09-05T09:00:00.000Z" };
    const n = eventChangeNotice("Cold Plunge", base, after);
    expect(n?.body).toContain("time");
    expect(n?.body).not.toContain("location");
  });

  it("flags an end-time change as a time change", () => {
    const after = { ...base, ends_at: "2026-09-05T12:00:00.000Z" };
    expect(eventChangeNotice("Cold Plunge", base, after)?.body).toContain("time");
  });

  it("flags a location change alone", () => {
    const after = { ...base, location_name: "Alnwick Garden" };
    const n = eventChangeNotice("Cold Plunge", base, after);
    expect(n?.body).toContain("location");
    expect(n?.body).not.toContain("time and location");
  });

  it("names both when time and place move together", () => {
    const after = { ...base, starts_at: "2026-09-05T09:00:00.000Z", location_name: "Alnwick Garden" };
    expect(eventChangeNotice("Cold Plunge", base, after)?.body).toContain("time and location");
  });

  it("includes the event title", () => {
    const after = { ...base, location_url: "https://maps.example/x" };
    expect(eventChangeNotice("Cold Plunge", base, after)?.body).toContain("Cold Plunge");
  });
});
