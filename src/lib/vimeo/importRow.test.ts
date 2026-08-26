import { describe, it, expect } from "vitest";
import { buildVimeoInsertRow, type VimeoImportSelection } from "./importRow";

const base: VimeoImportSelection = {
  id: "123456789",
  name: "Morning routine",
  description: "A short reset to start the day.",
  durationSeconds: 315,
  thumbnailUrl: "https://i.vimeocdn.com/video/large",
  hash: "abcdef1234",
};

const opts = { category: "mental_fitness" as const, folderId: "11111111-1111-1111-1111-111111111111", createdBy: "user-1" };

describe("buildVimeoInsertRow", () => {
  it("maps a video into a draft, day-agnostic, NTITT-wide insert row", () => {
    expect(buildVimeoInsertRow(base, opts)).toEqual({
      type: "video",
      title: "Morning routine",
      summary: "A short reset to start the day.",
      category: "mental_fitness",
      day_of_week: null,
      vimeo_id: "123456789",
      vimeo_hash: "abcdef1234",
      asset_path: null,
      external_url: null,
      thumbnail_url: "https://i.vimeocdn.com/video/large",
      tags: [],
      duration_seconds: 315,
      is_published: false,
      folder_id: "11111111-1111-1111-1111-111111111111",
      scheduled_for: null,
      created_by: "user-1",
    });
  });

  it("falls back to a placeholder title when the Vimeo name is blank", () => {
    expect(buildVimeoInsertRow({ ...base, name: "   " }, opts).title).toBe("Untitled Vimeo video");
  });

  it("truncates an over-long title and summary to the schema limits", () => {
    const row = buildVimeoInsertRow({ ...base, name: "T".repeat(250), description: "D".repeat(1500) }, opts);
    expect(row.title).toHaveLength(200);
    expect(row.summary).toHaveLength(1000);
  });

  it("null description becomes a null summary; null folder stays null", () => {
    const row = buildVimeoInsertRow({ ...base, description: null }, { ...opts, folderId: null });
    expect(row.summary).toBeNull();
    expect(row.folder_id).toBeNull();
  });

  it("defaults to a draft and never channel-targeted or tagged", () => {
    const row = buildVimeoInsertRow(base, opts);
    expect(row.is_published).toBe(false);
    expect(row.tags).toEqual([]);
    expect(row.day_of_week).toBeNull();
  });

  it("publishes live and carries cleaned tags when the auto-sync asks it to", () => {
    const row = buildVimeoInsertRow(base, {
      ...opts,
      isPublished: true,
      tags: ["#Sleep", "sleep", "  Grief ", "", "x".repeat(60)],
    });
    expect(row.is_published).toBe(true);
    // de-hashed, lowercased, de-duped, blanks + over-long dropped
    expect(row.tags).toEqual(["sleep", "grief"]);
  });

  it("accepts a null author (the automated sync has no session user)", () => {
    const row = buildVimeoInsertRow(base, { ...opts, createdBy: null });
    expect(row.created_by).toBeNull();
  });

  it("caps tags at six", () => {
    const row = buildVimeoInsertRow(base, {
      ...opts,
      tags: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });
    expect(row.tags).toHaveLength(6);
  });
});
