import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
// Avoid the storage round-trip -- posts in these tests carry no image.
vi.mock("@/lib/community/imageUpload", () => ({ signCommunityImageUrls: vi.fn(async () => new Map()) }));

type Data = Record<string, unknown[]>;
let data: Data;

// A PostgREST-shaped builder: paged reads end in .range() (slices `rows`);
// everything else is awaited directly (the builder is thenable -> {data: rows}).
function makeBuilder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    eq: () => b,
    in: () => b,
    not: () => b,
    order: () => b,
    limit: () => b,
    range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(onF, onR),
  });
  return b;
}
function makeClient() {
  return { from: (table: string) => makeBuilder(data[table] ?? []) };
}
// getAuthorInfo reads profiles through its own admin client.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => makeClient() }));

const { getPosts, getCommentsForPosts } = await import("./queries");

beforeEach(() => {
  data = { community_posts: [], community_likes: [], community_comments: [], profiles: [], companies: [] };
});

describe("getPosts likes/comments (E6/E7 M4 -- must page past the 1000-row cap)", () => {
  it("counts every like past the cap and keeps likedByViewer correct", async () => {
    const N = 1500;
    // The viewer's own like is the LAST row: a capped first-1000 read would drop
    // it, so likedByViewer would wrongly read false and likeCount would be 1000.
    const likes = Array.from({ length: N }, (_, i) => ({
      id: `l${String(i).padStart(5, "0")}`,
      post_id: "p1",
      user_id: i === N - 1 ? "viewer" : `u${i}`,
    }));
    data = {
      ...data,
      community_posts: [
        {
          id: "p1",
          user_id: "author",
          body: "hi",
          image_url: null,
          shared_badge_key: null,
          identity_override: null,
          created_at: new Date().toISOString(),
        },
      ],
      community_likes: likes,
    };

    const res = await getPosts(makeClient() as unknown as Parameters<typeof getPosts>[0], {
      scope: "global",
      board: "wins",
      viewerUserId: "viewer",
    });

    expect(res).toHaveLength(1);
    expect(res[0].likeCount).toBe(1500);
    expect(res[0].likedByViewer).toBe(true);
  });
});

describe("getCommentsForPosts (E6/E7 M5 -- must page past the 1000-row cap)", () => {
  it("pages and groups every comment across posts, not a capped 1000", async () => {
    const N = 1500;
    data = {
      ...data,
      community_comments: Array.from({ length: N }, (_, i) => ({
        id: `c${String(i).padStart(5, "0")}`,
        post_id: i % 2 === 0 ? "p1" : "p2",
        user_id: "u1",
        parent_comment_id: null,
        body: `b${i}`,
      })),
    };

    const map = await getCommentsForPosts(makeClient() as unknown as Parameters<typeof getCommentsForPosts>[0], [
      "p1",
      "p2",
    ]);

    const total = (map.get("p1")?.length ?? 0) + (map.get("p2")?.length ?? 0);
    expect(total).toBe(1500);
    expect(map.get("p1")!.length).toBe(750);
    expect(map.get("p2")!.length).toBe(750);
  });
});
