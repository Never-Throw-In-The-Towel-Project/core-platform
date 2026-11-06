import { describe, it, expect } from "vitest";
import { isVimeoIdConflict } from "./vimeoConflict";

describe("isVimeoIdConflict (E8 follow-up)", () => {
  it("matches a 23505 on the vimeo_id unique index", () => {
    expect(
      isVimeoIdConflict({
        code: "23505",
        message: 'duplicate key value violates unique constraint "content_items_vimeo_id_key"',
        details: "Key (vimeo_id)=(123456789) already exists.",
      })
    ).toBe(true);
  });

  it("ignores a 23505 on a DIFFERENT unique constraint", () => {
    expect(
      isVimeoIdConflict({
        code: "23505",
        message: 'duplicate key value violates unique constraint "content_channel_placements_content_item_id_company_id_key"',
        details: "Key (content_item_id, company_id)=(…, …) already exists.",
      })
    ).toBe(false);
  });

  it("ignores non-unique-violation errors", () => {
    expect(isVimeoIdConflict({ code: "23503", message: "foreign_key_violation on vimeo_id" })).toBe(false);
    expect(isVimeoIdConflict({ code: "42P01", message: "relation does not exist" })).toBe(false);
  });

  it("is safe on null/undefined/empty", () => {
    expect(isVimeoIdConflict(null)).toBe(false);
    expect(isVimeoIdConflict(undefined)).toBe(false);
    expect(isVimeoIdConflict({})).toBe(false);
    expect(isVimeoIdConflict({ code: "23505" })).toBe(false); // 23505 but no vimeo_id reference
  });
});
