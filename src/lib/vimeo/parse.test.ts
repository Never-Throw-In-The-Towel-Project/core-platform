import { describe, it, expect } from "vitest";
import {
  buildVimeoEmbedUrl,
  mapVimeoVideo,
  vimeoEmbedWarning,
  vimeoHashFrom,
  vimeoIdFromInput,
  vimeoIdFromUri,
  vimeoThumbnail,
} from "./parse";

describe("vimeoIdFromUri", () => {
  it("extracts the numeric id from a Vimeo API uri", () => {
    expect(vimeoIdFromUri("/videos/123456789")).toBe("123456789");
    expect(vimeoIdFromUri("/videos/123456789:abcdef")).toBe("123456789");
  });
  it("returns null for anything without a videos id", () => {
    expect(vimeoIdFromUri("/users/42")).toBeNull();
    expect(vimeoIdFromUri(null)).toBeNull();
    expect(vimeoIdFromUri(undefined)).toBeNull();
    expect(vimeoIdFromUri(12345)).toBeNull();
  });
});

describe("vimeoIdFromInput", () => {
  it("accepts a bare numeric id", () => {
    expect(vimeoIdFromInput("123456789")).toBe("123456789");
    expect(vimeoIdFromInput("  123 ")).toBe("123");
  });
  it("extracts from full Vimeo URLs (incl. unlisted hash + player URLs)", () => {
    expect(vimeoIdFromInput("https://vimeo.com/123456789")).toBe("123456789");
    expect(vimeoIdFromInput("https://vimeo.com/123456789/abcdef123")).toBe("123456789");
    expect(vimeoIdFromInput("https://player.vimeo.com/video/999888")).toBe("999888");
  });
  it("returns null for non-Vimeo input", () => {
    expect(vimeoIdFromInput("not a video")).toBeNull();
    expect(vimeoIdFromInput("https://youtube.com/watch?v=abc")).toBeNull();
  });
});

describe("vimeoHashFrom", () => {
  it("prefers the h param on player_embed_url", () => {
    expect(vimeoHashFrom({ player_embed_url: "https://player.vimeo.com/video/123?h=abcd1234&app_id=58479" })).toBe(
      "abcd1234"
    );
  });
  it("falls back to the link's hash segment", () => {
    expect(vimeoHashFrom({ link: "https://vimeo.com/123456789/deadbeef01" })).toBe("deadbeef01");
  });
  it("returns null for a public video (no hash anywhere)", () => {
    expect(vimeoHashFrom({ player_embed_url: "https://player.vimeo.com/video/123", link: "https://vimeo.com/123" })).toBeNull();
    expect(vimeoHashFrom({})).toBeNull();
  });
});

describe("vimeoThumbnail", () => {
  it("picks the largest size link", () => {
    const pics = {
      base_link: "https://i.vimeocdn.com/video/base",
      sizes: [
        { width: 200, link: "https://i.vimeocdn.com/video/small" },
        { width: 1280, link: "https://i.vimeocdn.com/video/large" },
        { width: 640, link: "https://i.vimeocdn.com/video/medium" },
      ],
    };
    expect(vimeoThumbnail(pics)).toBe("https://i.vimeocdn.com/video/large");
  });
  it("falls back to base_link, then null", () => {
    expect(vimeoThumbnail({ base_link: "https://i.vimeocdn.com/video/base" })).toBe("https://i.vimeocdn.com/video/base");
    expect(vimeoThumbnail({})).toBeNull();
    expect(vimeoThumbnail(null)).toBeNull();
  });
});

describe("mapVimeoVideo", () => {
  const raw = {
    uri: "/videos/123456789",
    name: "Morning routine",
    description: "A short reset to start the day.",
    duration: 315,
    link: "https://vimeo.com/123456789/abcdef1234",
    player_embed_url: "https://player.vimeo.com/video/123456789?h=abcdef1234",
    privacy: { view: "unlisted", embed: "whitelist" },
    pictures: { sizes: [{ width: 1280, link: "https://i.vimeocdn.com/video/large" }] },
  };

  it("maps a full video object", () => {
    expect(mapVimeoVideo(raw)).toEqual({
      id: "123456789",
      name: "Morning routine",
      description: "A short reset to start the day.",
      durationSeconds: 315,
      thumbnailUrl: "https://i.vimeocdn.com/video/large",
      hash: "abcdef1234",
      privacyView: "unlisted",
      privacyEmbed: "whitelist",
      embeddable: true,
      link: "https://vimeo.com/123456789/abcdef1234",
    });
  });

  it("returns null without a video id", () => {
    expect(mapVimeoVideo({ name: "orphan" })).toBeNull();
    expect(mapVimeoVideo(null)).toBeNull();
  });

  it("blank description becomes null; missing duration becomes null", () => {
    const m = mapVimeoVideo({ uri: "/videos/1", name: "x", description: "   ", duration: "nope" });
    expect(m?.description).toBeNull();
    expect(m?.durationSeconds).toBeNull();
  });

  it("marks embed=private as not embeddable", () => {
    const m = mapVimeoVideo({ uri: "/videos/1", privacy: { view: "nobody", embed: "private" } });
    expect(m?.embeddable).toBe(false);
  });
});

describe("buildVimeoEmbedUrl", () => {
  it("omits the hash when absent", () => {
    expect(buildVimeoEmbedUrl("123")).toBe("https://player.vimeo.com/video/123");
    expect(buildVimeoEmbedUrl("123", null)).toBe("https://player.vimeo.com/video/123");
  });
  it("appends ?h= for unlisted videos", () => {
    expect(buildVimeoEmbedUrl("123", "abcd")).toBe("https://player.vimeo.com/video/123?h=abcd");
  });
});

describe("vimeoEmbedWarning", () => {
  it("warns on embed=private / whitelist / password, else null", () => {
    expect(vimeoEmbedWarning({ privacyView: "nobody", privacyEmbed: "private" })).toMatch(/turned off/i);
    expect(vimeoEmbedWarning({ privacyView: "unlisted", privacyEmbed: "whitelist" })).toMatch(/allowlist/i);
    expect(vimeoEmbedWarning({ privacyView: "password", privacyEmbed: "public" })).toMatch(/password/i);
    expect(vimeoEmbedWarning({ privacyView: "anybody", privacyEmbed: "public" })).toBeNull();
  });
});
