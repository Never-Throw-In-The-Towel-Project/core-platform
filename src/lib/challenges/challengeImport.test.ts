import { describe, it, expect } from "vitest";
import {
  parseChallengeImportCsv,
  resolveChallengeContent,
  buildContentIndex,
} from "./challengeImport";

const VID_A = "11111111-1111-4111-8111-111111111111";
const VID_B = "22222222-2222-4222-8222-222222222222";

describe("parseChallengeImportCsv", () => {
  it("parses day + content + prompt rows", () => {
    const csv = `day,content,prompt
1,Breathing reset,Start with five minutes of box breathing.
2,,Rest day — take a gentle walk.
3,Mobility flow,`;
    const { rows, errors, fatal } = parseChallengeImportCsv(csv);
    expect(fatal).toBeUndefined();
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, dayIndex: 1, contentRef: "Breathing reset", prompt: "Start with five minutes of box breathing." },
      { line: 3, dayIndex: 2, contentRef: null, prompt: "Rest day — take a gentle walk." },
      { line: 4, dayIndex: 3, contentRef: "Mobility flow", prompt: null },
    ]);
  });

  it("accepts header aliases (day_index, note) and blank lines", () => {
    const csv = `day_index,content,note

1,Breathing reset,
`;
    const { rows, errors } = parseChallengeImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ line: 3, dayIndex: 1, contentRef: "Breathing reset", prompt: null }]);
  });

  it("is fatal when there is no `day` column", () => {
    const { fatal, rows } = parseChallengeImportCsv(`content,prompt\nBreathing reset,hi`);
    expect(fatal).toMatch(/needs at least a .?day.? column/i);
    expect(rows).toEqual([]);
  });

  it("is fatal on an empty file", () => {
    expect(parseChallengeImportCsv("   ").fatal).toMatch(/empty/i);
  });

  it("rejects a non-numeric or out-of-range day", () => {
    const { errors } = parseChallengeImportCsv(`day,prompt\nx,hi\n999,hi`);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toMatch(/day must be a whole number/i);
    expect(errors[1].message).toMatch(/day must be a whole number/i);
  });

  it("flags a day used twice, naming the earlier row", () => {
    const csv = `day,content\n1,Breathing reset\n1,Mobility flow`;
    const { errors, rows } = parseChallengeImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ line: 3, message: expect.stringMatching(/day 1 is used twice.*row 2/i) });
  });

  it("requires content or prompt (or both) per row", () => {
    const { errors } = parseChallengeImportCsv(`day,content,prompt\n1,,`);
    expect(errors).toEqual([{ line: 2, message: expect.stringMatching(/content reference, a prompt, or both/i) }]);
  });

  it("flags a row wider than the header (unquoted comma)", () => {
    const { errors } = parseChallengeImportCsv(`day,prompt\n1,walk, then stretch`);
    expect(errors[0].message).toMatch(/more columns than the header/i);
  });

  it("rejects an over-long prompt", () => {
    const { errors } = parseChallengeImportCsv(`day,prompt\n1,${"x".repeat(1001)}`);
    expect(errors[0].message).toMatch(/prompt is too long/i);
  });

  it("keeps a quoted comma inside a prompt", () => {
    const { rows } = parseChallengeImportCsv(`day,prompt\n1,"walk, then stretch"`);
    expect(rows[0].prompt).toBe("walk, then stretch");
  });
});

describe("resolveChallengeContent + buildContentIndex", () => {
  const index = buildContentIndex([
    { id: VID_A, title: "Breathing reset" },
    { id: VID_B, title: "Mobility flow" },
    { id: "33333333-3333-4333-8333-333333333333", title: "Dupe" },
    { id: "44444444-4444-4444-8444-444444444444", title: "Dupe" },
  ]);

  const parse = (csv: string) => parseChallengeImportCsv(csv).rows;

  it("resolves a unique title (case-insensitive) to its id", () => {
    const { resolved, errors } = resolveChallengeContent(parse(`day,content\n1,breathing RESET`), index);
    expect(errors).toEqual([]);
    expect(resolved).toEqual([{ day_index: 1, content_item_id: VID_A, prompt: null }]);
  });

  it("resolves a direct id reference", () => {
    const { resolved, errors } = resolveChallengeContent(parse(`day,content\n5,${VID_B}`), index);
    expect(errors).toEqual([]);
    expect(resolved[0].content_item_id).toBe(VID_B);
  });

  it("keeps a prompt-only day as null content", () => {
    const { resolved, errors } = resolveChallengeContent(parse(`day,prompt\n2,Rest day`), index);
    expect(errors).toEqual([]);
    expect(resolved).toEqual([{ day_index: 2, content_item_id: null, prompt: "Rest day" }]);
  });

  it("errors on an unknown title", () => {
    const { resolved, errors } = resolveChallengeContent(parse(`day,content\n1,Nope`), index);
    expect(resolved).toEqual([]);
    expect(errors[0].message).toMatch(/No content item titled/i);
  });

  it("errors on an unknown id", () => {
    const missing = "99999999-9999-4999-8999-999999999999";
    const { errors } = resolveChallengeContent(parse(`day,content\n1,${missing}`), index);
    expect(errors[0].message).toMatch(/No content item with id/i);
  });

  it("errors on an ambiguous title, asking for the id", () => {
    const { resolved, errors } = resolveChallengeContent(parse(`day,content\n1,Dupe`), index);
    expect(resolved).toEqual([]);
    expect(errors[0].message).toMatch(/More than one content item .* by id/i);
  });
});
