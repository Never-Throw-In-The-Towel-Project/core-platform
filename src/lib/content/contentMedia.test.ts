import { describe, it, expect } from "vitest";
import { resolveContentMediaUpdate, type ContentMediaCurrent } from "./contentMedia";

const asVideo: ContentMediaCurrent = { type: "video", asset_path: null, external_url: null, vimeo_id: "111" };
const asDocAsset: ContentMediaCurrent = { type: "document", asset_path: "content/a.pdf", external_url: null, vimeo_id: null };
const asDocUrl: ContentMediaCurrent = { type: "document", asset_path: null, external_url: "https://x/y.pdf", vimeo_id: null };

describe("resolveContentMediaUpdate", () => {
  it("video: sets vimeo, clears other media", () => {
    const r = resolveContentMediaUpdate({
      newType: "video", vimeoId: "222", externalUrl: null, newAssetPath: null, current: asVideo,
    });
    expect(r).toEqual({ ok: true, vimeo_id: "222", asset_path: null, external_url: null, removeAsset: null });
  });

  it("video: requires a vimeo id", () => {
    const r = resolveContentMediaUpdate({
      newType: "video", vimeoId: null, externalUrl: null, newAssetPath: null, current: asVideo,
    });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/Vimeo ID/i) });
  });

  it("document → video: orphans the old uploaded asset", () => {
    const r = resolveContentMediaUpdate({
      newType: "video", vimeoId: "333", externalUrl: null, newAssetPath: null, current: asDocAsset,
    });
    expect(r).toMatchObject({ ok: true, vimeo_id: "333", asset_path: null, external_url: null, removeAsset: "content/a.pdf" });
  });

  it("document: a new file wins and orphans the old asset", () => {
    const r = resolveContentMediaUpdate({
      newType: "document", vimeoId: null, externalUrl: null, newAssetPath: "content/b.pdf", current: asDocAsset,
    });
    expect(r).toMatchObject({ ok: true, asset_path: "content/b.pdf", external_url: null, vimeo_id: null, removeAsset: "content/a.pdf" });
  });

  it("document: an external url replaces an uploaded asset (which is orphaned)", () => {
    const r = resolveContentMediaUpdate({
      newType: "document", vimeoId: null, externalUrl: "https://x/new.pdf", newAssetPath: null, current: asDocAsset,
    });
    expect(r).toMatchObject({ ok: true, asset_path: null, external_url: "https://x/new.pdf", removeAsset: "content/a.pdf" });
  });

  it("document unchanged: keeps the existing asset, removes nothing", () => {
    const r = resolveContentMediaUpdate({
      newType: "document", vimeoId: null, externalUrl: null, newAssetPath: null, current: asDocAsset,
    });
    expect(r).toEqual({ ok: true, vimeo_id: null, asset_path: "content/a.pdf", external_url: null, removeAsset: null });
  });

  it("document(url) unchanged: keeps the external url", () => {
    const r = resolveContentMediaUpdate({
      newType: "document", vimeoId: null, externalUrl: null, newAssetPath: null, current: asDocUrl,
    });
    expect(r).toMatchObject({ ok: true, asset_path: null, external_url: "https://x/y.pdf", removeAsset: null });
  });

  it("video → document with no new media: errors (can't keep video media as a doc)", () => {
    const r = resolveContentMediaUpdate({
      newType: "document", vimeoId: null, externalUrl: null, newAssetPath: null, current: asVideo,
    });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/file to upload or an external link/i) });
  });

  it("image ← image: a new image asset replaces the old", () => {
    const currentImage: ContentMediaCurrent = { type: "image", asset_path: "content/old.png", external_url: null, vimeo_id: null };
    const r = resolveContentMediaUpdate({
      newType: "image", vimeoId: null, externalUrl: null, newAssetPath: "content/new.png", current: currentImage,
    });
    expect(r).toMatchObject({ ok: true, asset_path: "content/new.png", removeAsset: "content/old.png" });
  });
});
