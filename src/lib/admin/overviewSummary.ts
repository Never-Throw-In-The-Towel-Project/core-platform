import type { ContentItem, ContentType } from "@/types/database";
import { computeCoverageGaps, type CoverageGaps } from "@/lib/content/coverage";

/**
 * Pure shapes + arithmetic for the Super Admin Overview. Deliberately free of
 * `server-only`, Supabase, and any I/O so the maths is unit-testable in
 * isolation (mirrors coverage.ts). The server-only gatherer that reads the DB
 * lives in ./overview.ts and builds on these.
 */

export const CONTENT_TYPES: ContentType[] = ["video", "document", "image", "text"];

export interface ContentSummary {
  /** Everything in the library, published + draft. */
  total: number;
  published: number;
  drafts: number;
  /** Drafts with a future `scheduled_for` — queued to auto-publish. */
  scheduledAhead: number;
  byType: { type: ContentType; count: number }[];
  coverage: CoverageGaps;
}

export interface AdminOverviewData {
  /** ISO timestamp the snapshot was taken (counts are live per request). */
  generatedAt: string;
  companies: number;
  content: ContentSummary & { folders: number };
  community: {
    feedPosts: number;
    winsPosts: number;
    postsLast7d: number;
    comments: number;
    likes: number;
    badgesShared: number;
    openReports: number;
    resolvedReports: number;
  };
  events: {
    published: number;
    upcoming: number;
    bookingsConfirmed: number;
    bookingsTotal: number;
  };
  programming: {
    challengesPublished: number;
    noticesLive: number;
    podcastEpisodes: number;
  };
}

/**
 * Pure content roll-up from the already-fetched item list. `nowMs` is passed in
 * rather than read from the clock so "scheduled ahead" is deterministic.
 */
export function summarizeContentItems(items: ContentItem[], nowMs: number): ContentSummary {
  const published = items.filter((i) => i.is_published).length;
  const scheduledAhead = items.filter(
    (i) => !i.is_published && i.scheduled_for != null && new Date(i.scheduled_for).getTime() > nowMs
  ).length;

  const byType = CONTENT_TYPES.map((type) => ({
    type,
    count: items.filter((i) => i.type === type).length,
  }));

  return {
    total: items.length,
    published,
    drafts: items.length - published,
    scheduledAhead,
    byType,
    coverage: computeCoverageGaps(items),
  };
}

/** Zero-state used as the initial value and the try/catch degrade target, so the
 *  page renders its empty tiles rather than crashing on a bad client. */
export function emptyAdminOverview(): AdminOverviewData {
  return {
    generatedAt: new Date(0).toISOString(),
    companies: 0,
    content: {
      total: 0,
      published: 0,
      drafts: 0,
      scheduledAhead: 0,
      byType: CONTENT_TYPES.map((type) => ({ type, count: 0 })),
      coverage: computeCoverageGaps([]),
      folders: 0,
    },
    community: {
      feedPosts: 0,
      winsPosts: 0,
      postsLast7d: 0,
      comments: 0,
      likes: 0,
      badgesShared: 0,
      openReports: 0,
      resolvedReports: 0,
    },
    events: { published: 0, upcoming: 0, bookingsConfirmed: 0, bookingsTotal: 0 },
    programming: { challengesPublished: 0, noticesLive: 0, podcastEpisodes: 0 },
  };
}
