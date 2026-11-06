import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({
  requireNtittAdmin: vi.fn(() => Promise.resolve(undefined)),
  verifySession: vi.fn(() => Promise.resolve({ userId: "admin-1" })),
}));

// The removed post's image_url, varied per test. The session client's
// update(...).eq(...).select(...).maybeSingle() resolves to a row carrying it.
let postImageUrl: string | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => {
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      update: () => builder,
      eq: () => builder,
      select: () => builder,
      maybeSingle: () => Promise.resolve({ data: { image_url: postImageUrl }, error: null }),
      // reports update(...).eq(...) is awaited directly (no select)
      then: (onF: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onF),
    });
    return { from: () => builder };
  },
}));

// Capture the service-role storage delete.
const removeMock = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ remove: removeMock }) } }),
}));

const { removeCommunityPost } = await import("./communityModeration");

const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function form(): FormData {
  const f = new FormData();
  f.set("postId", POST_ID);
  return f;
}

describe("removeCommunityPost (A4 — purge the moderated photo from storage)", () => {
  beforeEach(() => removeMock.mockClear());

  it("deletes the post's image object from community-images on removal", async () => {
    postImageUrl = "u1/abc.jpg";
    const res = await removeCommunityPost({} as never, form());
    expect(res.status).toBe("success");
    expect(removeMock).toHaveBeenCalledWith(["u1/abc.jpg"]);
  });

  it("strips a legacy full URL down to the object path before deleting", async () => {
    postImageUrl = "https://proj.supabase.co/storage/v1/object/public/community-images/u1/2024/x.png";
    await removeCommunityPost({} as never, form());
    expect(removeMock).toHaveBeenCalledWith(["u1/2024/x.png"]);
  });

  it("does not call storage delete when the post has no image", async () => {
    postImageUrl = null;
    const res = await removeCommunityPost({} as never, form());
    expect(res.status).toBe("success");
    expect(removeMock).not.toHaveBeenCalled();
  });
});
