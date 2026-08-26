import { describe, it, expect } from "vitest";
import { enrichVideoFields } from "./enrich";

const video = {
  description: "A short reset to start the day.",
  durationSeconds: 315,
  thumbnailUrl: "https://i.vimeocdn.com/video/large",
  hash: "abcdef1234",
};

describe("enrichVideoFields", () => {
  it("fills thumbnail, hash and duration from Vimeo", () => {
    const e = enrichVideoFields({ summary: null }, video);
    expect(e.thumbnail_url).toBe("https://i.vimeocdn.com/video/large");
    expect(e.vimeo_hash).toBe("abcdef1234");
    expect(e.duration_seconds).toBe(315);
  });

  it("uses Vimeo's description when the operator left the summary blank", () => {
    expect(enrichVideoFields({ summary: null }, video).summary).toBe("A short reset to start the day.");
    expect(enrichVideoFields({ summary: "   " }, video).summary).toBe("A short reset to start the day.");
  });

  it("keeps the operator's summary when they wrote one", () => {
    expect(enrichVideoFields({ summary: "My own words" }, video).summary).toBe("My own words");
  });

  it("leaves fields null when Vimeo has nothing", () => {
    const e = enrichVideoFields({ summary: null }, { description: null, durationSeconds: null, thumbnailUrl: null, hash: null });
    expect(e).toEqual({ summary: null, thumbnail_url: null, vimeo_hash: null, duration_seconds: null });
  });
});
