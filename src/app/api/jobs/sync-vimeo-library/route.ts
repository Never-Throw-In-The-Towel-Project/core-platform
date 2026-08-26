import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { syncVimeoLibrary } from "@/lib/vimeo/sync";

/**
 * Hourly auto-sync: pulls any newly-uploaded Vimeo videos into the platform,
 * AI-categorises them and publishes them live — the "constantly and
 * automatically feeding new uploads into the Brain and Library" behaviour the
 * operator asked for. Runs the SAME engine as the Brain's "Sync entire library"
 * button (lib/vimeo/sync.ts), so manual and automatic ingestion can't drift.
 *
 * Idempotent (dedup by vimeo_id — a re-run only ever adds what's genuinely new)
 * and bounded (imports at most a batch per tick; a large backlog drains over
 * successive hours, or instantly via the button). Authenticated by the same
 * CRON_SECRET bearer as every other job; uses the service role so RLS doesn't
 * hide rows. Degrades to a no-op when Vimeo isn't connected — never an error.
 */
export const dynamic = "force-dynamic";

// Per-tick cap. New uploads are few, so this is plenty for the steady state; a
// big first-time backlog is better drained with the Brain button (which loops).
const CRON_LIMIT = 25;

export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result = await syncVimeoLibrary(supabase, {
    publish: true,
    limit: CRON_LIMIT,
    createdBy: null, // no session user for an automated run; created_by is nullable
  });

  if (result.status === "not_configured") {
    // Vimeo is optional — a deployment without a token just skips this job.
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }
  if (result.status === "error") {
    console.error("[cron:sync-vimeo-library] sync failed", result.message);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
  }

  if (result.imported > 0) {
    console.log(
      `[cron:sync-vimeo-library] imported ${result.imported} new video(s)` +
        (result.more ? " (more remain — next tick continues)" : "")
    );
  }
  return NextResponse.json({ ok: true, imported: result.imported, more: result.more });
}
