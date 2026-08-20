// Schema-readiness for the `/api/health` detail report. PURE (no DB, no
// "server-only") so it's unit-testable; the actual table probe is injected by
// the route (which owns the Supabase client). Mirrors the progress.ts /
// queries.ts split.
//
// The gap this closes: a migration merged to the repo is NOT applied to a remote
// database until someone runs `supabase db push` (CI only dry-runs migrations;
// see docs/POST_MERGE_PROD_CHECKLIST.md). When that step is missed, code ships
// expecting tables that don't exist and writes fail at runtime with no operator
// signal -- exactly how the Clean Streak "Couldn't start that" bug reached prod.
// This probes a small set of SENTINEL tables from the most recent migrations; a
// missing one means that migration hasn't been applied here.
//
// KEEP IN SYNC: when a migration adds a feature's core table, add its newest
// table below (same discipline as GROUP_DEFS ↔ .env.example). Old, long-applied
// tables don't need an entry -- only recent ones at risk of being un-pushed.

export const SCHEMA_SENTINELS: { schema: "public" | "private"; table: string; migration: string }[] = [
  { schema: "private", table: "habit_challenges", migration: "20260826000000_habit_clean_streak" },
  { schema: "private", table: "habit_check_ins", migration: "20260826000000_habit_clean_streak" },
];

export type SchemaSentinel = (typeof SCHEMA_SENTINELS)[number];

export type SchemaReadiness = {
  /** True when every sentinel table exists in this database. */
  ok: boolean;
  /** Sentinels whose table is absent -> the migration hasn't been applied here. */
  missing: SchemaSentinel[];
};

/** Pure shaping: partition the sentinels by an existence flag. */
export function summarizeSchema(sentinels: SchemaSentinel[], exists: boolean[]): SchemaReadiness {
  const missing = sentinels.filter((_, i) => !exists[i]);
  return { ok: missing.length === 0, missing };
}

/** Probe every sentinel with the caller-supplied `exists` check and summarise.
 *  The probe is injected (the route provides one backed by the Supabase client)
 *  so this module stays free of server-only imports and is unit-testable. */
export async function checkSchemaReadiness(
  probe: (s: SchemaSentinel) => Promise<boolean>
): Promise<SchemaReadiness> {
  const exists = await Promise.all(SCHEMA_SENTINELS.map(probe));
  return summarizeSchema(SCHEMA_SENTINELS, exists);
}
