// E8 follow-up — recognise the unique(vimeo_id) violation.
//
// content_items now has a PARTIAL unique index `content_items_vimeo_id_key`
// (one Vimeo video => at most one row). The three import paths still dedup with
// a read-then-insert pre-check, which races: a concurrent import can slip a row
// in between the pre-check and the INSERT, so the INSERT then fails with
// Postgres unique_violation (SQLSTATE 23505). A manual single-create or a CSV
// with a repeated id hits the same error.
//
// This narrows a 23505 to specifically the vimeo_id index so callers can skip
// or report it, without swallowing an unrelated unique violation (e.g.
// content_channel_placements' own unique constraint).

// Structural shape of a Supabase/PostgREST error — matches PostgrestError
// without coupling this pure helper to the SDK type.
type DbError = { code?: string | null; message?: string | null; details?: string | null };

export function isVimeoIdConflict(error: DbError | null | undefined): boolean {
  if (!error || error.code !== "23505") return false;
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return haystack.includes("content_items_vimeo_id_key") || haystack.includes("vimeo_id");
}
