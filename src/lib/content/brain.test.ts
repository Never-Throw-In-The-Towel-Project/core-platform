import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { contentAssetSignedUrl, resolveAssetUrls } = await import("./brain");

function clientWith(createSignedUrls: unknown, createSignedUrl?: unknown) {
  return { storage: { from: () => ({ createSignedUrls, createSignedUrl }) } };
}

describe("content-assets signed URLs (bucket lockdown)", () => {
  it("resolveAssetUrls maps item id -> signed URL and skips items with no asset", async () => {
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })),
      error: null,
    }));
    const items = [
      { id: "a", asset_path: "x/a.pdf" },
      { id: "b", asset_path: null },
      { id: "c", asset_path: "x/c.png" },
    ];

    const map = await resolveAssetUrls(clientWith(createSignedUrls) as never, items as never);

    expect(map).toEqual({ a: "https://signed/x/a.pdf", c: "https://signed/x/c.png" });
    expect(createSignedUrls).toHaveBeenCalledWith(["x/a.pdf", "x/c.png"], expect.any(Number));
  });

  it("resolveAssetUrls returns {} and never calls storage when nothing has an asset", async () => {
    const createSignedUrls = vi.fn();

    const map = await resolveAssetUrls(clientWith(createSignedUrls) as never, [{ id: "a", asset_path: null }] as never);

    expect(map).toEqual({});
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("resolveAssetUrls omits an item whose URL could not be signed", async () => {
    const createSignedUrls = vi.fn(async () => ({
      data: [
        { path: "x/a.pdf", signedUrl: "https://signed/a", error: null },
        { path: "x/c.png", signedUrl: null, error: "denied" },
      ],
      error: null,
    }));
    const items = [
      { id: "a", asset_path: "x/a.pdf" },
      { id: "c", asset_path: "x/c.png" },
    ];

    const map = await resolveAssetUrls(clientWith(createSignedUrls) as never, items as never);

    expect(map).toEqual({ a: "https://signed/a" });
  });

  it("contentAssetSignedUrl returns the signed URL, or null on error", async () => {
    const ok = clientWith(
      undefined,
      vi.fn(async () => ({ data: { signedUrl: "https://signed/one" }, error: null }))
    );
    expect(await contentAssetSignedUrl(ok as never, "x/one.pdf")).toBe("https://signed/one");

    const bad = clientWith(undefined, vi.fn(async () => ({ data: null, error: "nope" })));
    expect(await contentAssetSignedUrl(bad as never, "x/one.pdf")).toBeNull();
  });
});
