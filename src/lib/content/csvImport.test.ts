import { describe, it, expect } from "vitest";
import { parseCsv, parseContentImportCsv } from "./csvImport";

describe("parseCsv", () => {
  it("splits simple rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas and newlines inside quotes", () => {
    expect(parseCsv('a,"b, still b","line1\nline2"')).toEqual([["a", "b, still b", "line1\nline2"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('"she said ""hi""",x')).toEqual([['she said "hi"', "x"]]);
  });

  it("handles CRLF line endings and strips a leading BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      [""],
    ]);
  });
});

const HEADER = "type,title,category,day,vimeo_id,external_url,tags,summary,publish";

describe("parseContentImportCsv", () => {
  it("maps a clean video row to an insert-ready shape", () => {
    const csv = `${HEADER}\nvideo,Breathing reset,mental_fitness,monday,123456789,,"stress;sleep",A reset,true`;
    const { rows, errors, fatal, dataRowCount } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(fatal).toBeUndefined();
    expect(errors).toEqual([]);
    expect(dataRowCount).toBe(1);
    expect(rows).toEqual([
      {
        type: "video",
        title: "Breathing reset",
        summary: "A reset",
        category: "mental_fitness",
        day_of_week: 1,
        vimeo_id: "123456789",
        asset_path: null,
        external_url: null,
        tags: ["stress", "sleep"],
        is_published: true,
      },
    ]);
  });

  it("defaults type to video and day to null (any day)", () => {
    const csv = "title,category,vimeo_id\nMobility,physical_fitness,987654321";
    const { rows } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(rows[0]).toMatchObject({ type: "video", day_of_week: null, vimeo_id: "987654321" });
  });

  it("uses defaultPublish when the publish cell is blank, and lets a cell override it", () => {
    const csv = `${HEADER}\nvideo,A,mental_fitness,,1,,,,\nvideo,B,mental_fitness,,2,,,,false`;
    const draftDefault = parseContentImportCsv(csv, { defaultPublish: false });
    expect(draftDefault.rows.map((r) => r.is_published)).toEqual([false, false]);
    const liveDefault = parseContentImportCsv(csv, { defaultPublish: true });
    // Row 1 follows the default (true); row 2's explicit "false" still wins.
    expect(liveDefault.rows.map((r) => r.is_published)).toEqual([true, false]);
  });

  it("splits tags on comma, semicolon, or pipe and de-duplicates", () => {
    const csv = `${HEADER}\nvideo,A,mental_fitness,,1,,"grief;sleep|grief, calm",,true`;
    const { rows } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(rows[0].tags).toEqual(["grief", "sleep", "calm"]);
  });

  it("accepts header aliases (Theme, Vimeo ID, Day of week) case-insensitively", () => {
    const csv = "Title,Theme,Day of week,Vimeo ID\nA,nutrition,Fri,555";
    const { rows, errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ category: "nutrition", day_of_week: 5, vimeo_id: "555" });
  });

  it("maps a document row via external_url", () => {
    const csv = `${HEADER}\ndocument,Guide,nutrition,,,https://example.com/g.pdf,,One pager,false`;
    const { rows, errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      type: "document",
      external_url: "https://example.com/g.pdf",
      vimeo_id: null,
      is_published: false,
    });
  });

  it("reports a fatal error when title/category columns are missing", () => {
    const { fatal, rows } = parseContentImportCsv("foo,bar\n1,2", { defaultPublish: true });
    expect(fatal).toMatch(/title.*category/i);
    expect(rows).toEqual([]);
  });

  it("reports a fatal error for an empty file", () => {
    expect(parseContentImportCsv("   \n  ", { defaultPublish: true }).fatal).toMatch(/empty/i);
  });

  it("flags a video row with no vimeo_id, anchored to its file line", () => {
    const csv = `${HEADER}\nvideo,No media,mental_fitness,,,,,,`;
    const { rows, errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 2, message: expect.stringMatching(/vimeo_id/i) }]);
  });

  it("flags a document row with no external_url", () => {
    const csv = `${HEADER}\ndocument,No link,nutrition,,,,,,`;
    const { errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(errors[0].message).toMatch(/external_url/i);
  });

  it("rejects a Vimeo URL in the vimeo_id column (numeric only)", () => {
    const csv = `${HEADER}\nvideo,A,mental_fitness,,https://vimeo.com/123,,,,`;
    const { errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(errors[0].message).toMatch(/numeric Vimeo ID/i);
  });

  it("flags an unknown category and an out-of-range day", () => {
    const badCat = `${HEADER}\nvideo,A,wellbeing,,1,,,,`;
    expect(parseContentImportCsv(badCat, { defaultPublish: true }).errors[0].message).toMatch(/category/i);
    const badDay = `${HEADER}\nvideo,A,mental_fitness,9,1,,,,`;
    expect(parseContentImportCsv(badDay, { defaultPublish: true }).errors[0].message).toMatch(/day/i);
  });

  it("validates every row but returns the valid ones alongside the errors (caller enforces all-or-nothing)", () => {
    const csv = `${HEADER}\nvideo,Good,mental_fitness,,1,,,,\nvideo,Bad,mental_fitness,,,,,,`;
    const { rows, errors, dataRowCount } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(dataRowCount).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Good");
    expect(errors).toEqual([{ line: 3, message: expect.stringMatching(/vimeo_id/i) }]);
  });

  it("skips blank lines without shifting line numbers", () => {
    const csv = `${HEADER}\n\nvideo,A,mental_fitness,,,,,,`;
    const { errors, dataRowCount } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(dataRowCount).toBe(1);
    // The blank line 2 is skipped; the real row is line 3.
    expect(errors).toEqual([{ line: 3, message: expect.stringMatching(/vimeo_id/i) }]);
  });

  it("flags a row with more columns than the header (likely an unquoted comma)", () => {
    const csv = `${HEADER}\nvideo,A,mental_fitness,,1,,grief, sleep,summary,true`;
    const { errors } = parseContentImportCsv(csv, { defaultPublish: true });
    expect(errors[0].message).toMatch(/more columns than the header/i);
  });
});
