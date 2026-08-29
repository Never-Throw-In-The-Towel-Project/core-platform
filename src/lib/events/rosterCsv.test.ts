import { describe, it, expect } from "vitest";
import { buildRosterCsv, rosterCsvFilename, type RosterCsvRow } from "./rosterCsv";

describe("buildRosterCsv", () => {
  it("writes a header even with no rows", () => {
    expect(buildRosterCsv([])).toBe('"Status","Name","Email","Type","Booked at"');
  });

  it("includes the member email that the old client export left blank", () => {
    const rows: RosterCsvRow[] = [
      { status: "Confirmed", name: "Andy", email: "andy@work.co", type: "Member", bookedAt: "2026-09-01T10:00:00Z" },
    ];
    const csv = buildRosterCsv(rows);
    expect(csv).toContain('"andy@work.co"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("escapes quotes and keeps commas inside a field", () => {
    const rows: RosterCsvRow[] = [
      { status: "Waitlist", name: 'Sam "Sammy", Jr', email: "", type: "Guest", bookedAt: "x" },
    ];
    const csv = buildRosterCsv(rows);
    // embedded quotes doubled, whole field wrapped -> the comma doesn't split columns
    expect(csv).toContain('"Sam ""Sammy"", Jr"');
  });

  it("uses CRLF between rows", () => {
    const rows: RosterCsvRow[] = [
      { status: "Confirmed", name: "A", email: "a@b.co", type: "Member", bookedAt: "t" },
    ];
    expect(buildRosterCsv(rows)).toContain("\r\n");
  });
});

describe("rosterCsvFilename", () => {
  it("slugifies the title", () => {
    expect(rosterCsvFilename("Cold Plunge River Dip")).toBe("cold-plunge-river-dip-roster.csv");
  });

  it("falls back to 'event' for a title with no usable characters", () => {
    expect(rosterCsvFilename("!!!")).toBe("event-roster.csv");
  });
});
