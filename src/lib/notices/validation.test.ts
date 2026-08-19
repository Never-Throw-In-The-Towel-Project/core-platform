import { describe, it, expect } from "vitest";
import {
  validateNoticeFields,
  normaliseVimeoId,
  firstNoticeErrorField,
  NOTICE_LIMITS,
  type NoticeFieldValues,
} from "./validation";

const base: NoticeFieldValues = {
  title: "Monday motivation",
  body: "",
  mediaKind: "none",
  vimeoId: "",
  hasImage: false,
  weekday: "",
  startsOn: "",
  endsOn: "",
  ctaLabel: "",
  ctaUrl: "",
};

describe("validateNoticeFields", () => {
  it("accepts a minimal text-only notice", () => {
    expect(validateNoticeFields(base)).toEqual({});
  });

  it("requires a headline", () => {
    expect(validateNoticeFields({ ...base, title: "   " })).toHaveProperty("title");
  });

  it("caps the headline length", () => {
    const long = "x".repeat(NOTICE_LIMITS.title + 1);
    expect(validateNoticeFields({ ...base, title: long })).toHaveProperty("title");
  });

  it("vimeo kind needs a numeric id", () => {
    expect(validateNoticeFields({ ...base, mediaKind: "vimeo", vimeoId: "" })).toHaveProperty("vimeoId");
    expect(validateNoticeFields({ ...base, mediaKind: "vimeo", vimeoId: "https://vimeo.com/123" })).toHaveProperty(
      "vimeoId"
    );
    expect(validateNoticeFields({ ...base, mediaKind: "vimeo", vimeoId: "123456789" })).toEqual({});
  });

  it("image kind needs an image present", () => {
    expect(validateNoticeFields({ ...base, mediaKind: "image", hasImage: false })).toHaveProperty("image");
    expect(validateNoticeFields({ ...base, mediaKind: "image", hasImage: true })).toEqual({});
  });

  it("rejects an end date before the start date", () => {
    const r = validateNoticeFields({ ...base, startsOn: "2026-12-25", endsOn: "2026-12-20" });
    expect(r).toHaveProperty("endsOn");
  });

  it("accepts a valid inclusive date window", () => {
    expect(validateNoticeFields({ ...base, startsOn: "2026-12-20", endsOn: "2026-12-25" })).toEqual({});
  });

  it("flags a CTA label with no link (DB CHECK parity)", () => {
    const r = validateNoticeFields({ ...base, ctaLabel: "Book now", ctaUrl: "" });
    expect(r).toHaveProperty("ctaLabel");
  });

  it("requires a valid CTA url", () => {
    expect(validateNoticeFields({ ...base, ctaUrl: "not a url" })).toHaveProperty("ctaUrl");
    expect(validateNoticeFields({ ...base, ctaLabel: "Go", ctaUrl: "https://ntitt.co.uk/events" })).toEqual({});
  });

  it("rejects an out-of-range weekday", () => {
    expect(validateNoticeFields({ ...base, weekday: "8" })).toHaveProperty("weekday");
    expect(validateNoticeFields({ ...base, weekday: "1" })).toEqual({});
  });
});

describe("firstNoticeErrorField", () => {
  it("returns the topmost invalid field in visual order", () => {
    const errors = validateNoticeFields({ ...base, title: "", ctaUrl: "bad" });
    expect(firstNoticeErrorField(errors)).toBe("title");
  });

  it("returns null when clean", () => {
    expect(firstNoticeErrorField({})).toBeNull();
  });
});

describe("normaliseVimeoId", () => {
  it("keeps a numeric id, trimmed", () => {
    expect(normaliseVimeoId("  123456  ")).toBe("123456");
  });
  it("drops anything non-numeric", () => {
    expect(normaliseVimeoId("https://vimeo.com/123")).toBeNull();
    expect(normaliseVimeoId("")).toBeNull();
    expect(normaliseVimeoId(null)).toBeNull();
  });
});
