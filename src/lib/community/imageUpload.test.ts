import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { uploadCommunityImage, communityImagePath, signCommunityImageUrls } = await import(
  "./imageUpload"
);

// A minimal stand-in for the storage client surface these functions touch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientWith(from: () => unknown): any {
  return { storage: { from } };
}

describe("communityImagePath", () => {
  it("returns a bare path unchanged (new rows)", () => {
    expect(communityImagePath("u1/abc.jpg")).toBe("u1/abc.jpg");
  });

  it("strips the public-URL prefix from legacy rows", () => {
    const url =
      "https://proj.supabase.co/storage/v1/object/public/community-images/u1/abc.jpg";
    expect(communityImagePath(url)).toBe("u1/abc.jpg");
  });

  it("keeps a nested folder path intact after the bucket segment", () => {
    const url =
      "https://proj.supabase.co/storage/v1/object/public/community-images/u1/2024/abc.png";
    expect(communityImagePath(url)).toBe("u1/2024/abc.png");
  });

  it("leaves a value with no bucket segment as-is", () => {
    expect(communityImagePath("not-a-community-url")).toBe("not-a-community-url");
  });
});

describe("signCommunityImageUrls", () => {
  it("signs nothing and makes no request for an empty input", async () => {
    const createSignedUrls = vi.fn();
    const supabase = clientWith(() => ({ createSignedUrls }));
    const out = await signCommunityImageUrls(supabase, []);
    expect(out.size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("maps each stored value to its signed URL", async () => {
    const createSignedUrls = vi.fn(() =>
      Promise.resolve({
        data: [
          { path: "u1/a.jpg", signedUrl: "https://signed/a", error: null },
          { path: "u2/b.png", signedUrl: "https://signed/b", error: null },
        ],
        error: null,
      })
    );
    const supabase = clientWith(() => ({ createSignedUrls }));
    const out = await signCommunityImageUrls(supabase, ["u1/a.jpg", "u2/b.png"]);
    expect(out.get("u1/a.jpg")).toBe("https://signed/a");
    expect(out.get("u2/b.png")).toBe("https://signed/b");
  });

  it("normalises a legacy full URL to its path before signing, keyed by the original value", async () => {
    const createSignedUrls = vi.fn(() =>
      Promise.resolve({
        data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a", error: null }],
        error: null,
      })
    );
    const supabase = clientWith(() => ({ createSignedUrls }));
    const legacy =
      "https://proj.supabase.co/storage/v1/object/public/community-images/u1/a.jpg";
    const out = await signCommunityImageUrls(supabase, [legacy]);
    // Signed by path, but the map is keyed by the original stored value so the
    // caller can look up straight from the row.
    expect(createSignedUrls).toHaveBeenCalledWith(["u1/a.jpg"], expect.any(Number));
    expect(out.get(legacy)).toBe("https://signed/a");
  });

  it("de-dupes identical paths into a single sign request", async () => {
    const createSignedUrls = vi.fn(() =>
      Promise.resolve({
        data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a", error: null }],
        error: null,
      })
    );
    const supabase = clientWith(() => ({ createSignedUrls }));
    await signCommunityImageUrls(supabase, ["u1/a.jpg", "u1/a.jpg"]);
    expect(createSignedUrls).toHaveBeenCalledWith(["u1/a.jpg"], expect.any(Number));
  });

  it("omits references that fail to sign (renders without the image, not a broken link)", async () => {
    const createSignedUrls = vi.fn(() =>
      Promise.resolve({
        data: [
          { path: "u1/a.jpg", signedUrl: "https://signed/a", error: null },
          { path: "u2/gone.png", signedUrl: null, error: "Object not found" },
        ],
        error: null,
      })
    );
    const supabase = clientWith(() => ({ createSignedUrls }));
    const out = await signCommunityImageUrls(supabase, ["u1/a.jpg", "u2/gone.png"]);
    expect(out.get("u1/a.jpg")).toBe("https://signed/a");
    expect(out.has("u2/gone.png")).toBe(false);
  });

  it("returns an empty map (no throw) when the whole batch errors", async () => {
    const createSignedUrls = vi.fn(() => Promise.resolve({ data: null, error: "denied" }));
    const supabase = clientWith(() => ({ createSignedUrls }));
    const out = await signCommunityImageUrls(supabase, ["u1/a.jpg"]);
    expect(out.size).toBe(0);
  });
});

describe("uploadCommunityImage", () => {
  let upload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upload = vi.fn(() => Promise.resolve({ error: null }));
  });

  function fakeFile(type: string, size: number): File {
    return { type, size } as unknown as File;
  }

  it("returns the stored object path scoped to the user's folder (not a URL)", async () => {
    const supabase = clientWith(() => ({ upload }));
    const res = await uploadCommunityImage(supabase, "user-1", fakeFile("image/png", 100));
    expect("path" in res).toBe(true);
    if ("path" in res) {
      expect(res.path).toMatch(/^user-1\/[0-9a-f-]+\.png$/);
    }
    // Uploaded to the community-images bucket at that same path.
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\//),
      expect.anything(),
      { contentType: "image/png" }
    );
  });

  it("rejects an unsupported type before touching storage", async () => {
    const supabase = clientWith(() => ({ upload }));
    const res = await uploadCommunityImage(supabase, "user-1", fakeFile("image/svg+xml", 100));
    expect(res).toEqual({ error: expect.stringContaining("JPEG") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit before touching storage", async () => {
    const supabase = clientWith(() => ({ upload }));
    const res = await uploadCommunityImage(
      supabase,
      "user-1",
      fakeFile("image/jpeg", 6 * 1024 * 1024)
    );
    expect(res).toEqual({ error: expect.stringContaining("5MB") });
    expect(upload).not.toHaveBeenCalled();
  });
});
