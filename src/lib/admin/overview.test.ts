import { describe, it, expect } from "vitest";
import { summarizeContentItems } from "./overviewSummary";
import type { ContentItem, ContentType } from "@/types/database";

// Minimal factory -- only the fields summarizeContentItems reads (type,
// is_published, scheduled_for, day_of_week, category) vary; the rest is filler.
function item(
  overrides: Partial<
    Pick<ContentItem, "type" | "is_published" | "scheduled_for" | "day_of_week" | "category">
  > & { id: string }
): ContentItem {
  return {
    type: "video",
    title: overrides.id,
    summary: null,
    category: "mental_fitness",
    day_of_week: null,
    vimeo_id: null,
    vimeo_hash: null,
    asset_path: null,
    external_url: null,
    thumbnail_url: null,
    tags: [],
    workout_tier: null,
    duration_seconds: null,
    is_published: true,
    created_by: null,
    folder_id: null,
    scheduled_for: null,
    created_at: "2026-08-13T00:00:00Z",
    ...overrides,
  };
}

const NOW = Date.parse("2026-08-22T00:00:00Z");

describe("summarizeContentItems", () => {
  it("splits published vs drafts and totals", () => {
    const s = summarizeContentItems(
      [
        item({ id: "a", is_published: true }),
        item({ id: "b", is_published: true }),
        item({ id: "c", is_published: false }),
      ],
      NOW
    );
    expect(s.total).toBe(3);
    expect(s.published).toBe(2);
    expect(s.drafts).toBe(1);
  });

  it("counts only future-dated drafts as scheduled ahead", () => {
    const s = summarizeContentItems(
      [
        item({ id: "future", is_published: false, scheduled_for: "2026-08-25" }),
        item({ id: "past", is_published: false, scheduled_for: "2026-08-01" }),
        item({ id: "none", is_published: false, scheduled_for: null }),
        // A published item with a future date is not a pending draft.
        item({ id: "published-future", is_published: true, scheduled_for: "2026-08-30" }),
      ],
      NOW
    );
    expect(s.scheduledAhead).toBe(1);
  });

  it("breaks the library down by every content type", () => {
    const types: ContentType[] = ["video", "video", "document", "image", "text"];
    const s = summarizeContentItems(
      types.map((type, i) => item({ id: `${type}-${i}`, type })),
      NOW
    );
    const byType = Object.fromEntries(s.byType.map((t) => [t.type, t.count]));
    expect(byType).toEqual({ video: 2, document: 1, image: 1, text: 1 });
    // All four types are always present, even at zero, for a stable layout.
    expect(s.byType.map((t) => t.type)).toEqual(["video", "document", "image", "text"]);
  });

  it("delegates coverage to computeCoverageGaps (published only)", () => {
    const s = summarizeContentItems(
      [
        item({ id: "p", is_published: true, day_of_week: 1, category: "nutrition" }),
        item({ id: "d", is_published: false, day_of_week: 2, category: "nutrition" }),
      ],
      NOW
    );
    expect(s.coverage.totalPublished).toBe(1);
    expect(s.coverage.perDay.find((d) => d.day === 1)?.count).toBe(1);
    // The draft on day 2 doesn't fill day 2's coverage.
    expect(s.coverage.perDay.find((d) => d.day === 2)?.count).toBe(0);
  });

  it("handles an empty library without throwing", () => {
    const s = summarizeContentItems([], NOW);
    expect(s.total).toBe(0);
    expect(s.published).toBe(0);
    expect(s.drafts).toBe(0);
    expect(s.scheduledAhead).toBe(0);
    expect(s.byType.every((t) => t.count === 0)).toBe(true);
  });
});
