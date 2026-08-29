// Storage-bucket readiness for the `/api/health` detail report. PURE (no DB, no
// "server-only") so it's unit-testable; the actual bucket probe is injected by
// the route (which owns the Supabase client). Sibling of schema.ts -- same
// split, same KEEP-IN-SYNC discipline.
//
// The gap this closes: the schema probe checks TABLES, so a migration that only
// creates a STORAGE BUCKET is invisible to it. That is exactly how the
// event-images bucket (20260823000000) went missing in prod -- the migration
// was merged but not `supabase db push`-ed, so every event image upload failed
// with a generic Storage error while every table sentinel still read "ok". A
// bucket the app uploads to is as load-bearing as a table; probe it the same way.
//
// KEEP IN SYNC: when a migration adds a public bucket the app uploads to, add
// its id below (same discipline as SCHEMA_SENTINELS ↔ .env.example).

export const STORAGE_BUCKETS: { bucket: string; migration: string }[] = [
  { bucket: "community-images", migration: "20260731040000_phase9_community_photo_storage" },
  { bucket: "content-assets", migration: "20260812010000_content_platform_spine" },
  { bucket: "event-images", migration: "20260823000000_event_images_storage" },
  { bucket: "notice-media", migration: "20260824000000_notices" },
  { bucket: "notice-videos", migration: "20260825000000_notice_videos_storage" },
];

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

export type StorageReadiness = {
  /** True when every bucket exists in this project's storage. */
  ok: boolean;
  /** Buckets that are absent -> the migration that creates them hasn't been applied here. */
  missing: StorageBucket[];
};

/** Pure shaping: partition the buckets by an existence flag. */
export function summarizeStorage(buckets: StorageBucket[], exists: boolean[]): StorageReadiness {
  const missing = buckets.filter((_, i) => !exists[i]);
  return { ok: missing.length === 0, missing };
}

/** Probe every bucket with the caller-supplied `exists` check and summarise.
 *  The probe is injected (the route provides one backed by the Supabase client)
 *  so this module stays free of server-only imports and is unit-testable. */
export async function checkStorageReadiness(
  probe: (b: StorageBucket) => Promise<boolean>
): Promise<StorageReadiness> {
  const exists = await Promise.all(STORAGE_BUCKETS.map(probe));
  return summarizeStorage(STORAGE_BUCKETS, exists);
}
