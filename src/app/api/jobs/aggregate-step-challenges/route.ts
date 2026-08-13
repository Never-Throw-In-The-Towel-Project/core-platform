import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { computeStepTotals, pickChallengeAwards } from "@/lib/steps/challenge";
import { sendTargetHitEmail } from "@/lib/steps/challengeNotify";

/**
 * The private -> public aggregation for the COMPANY STEP CHALLENGE (brief §2).
 * Runs daily via Vercel Cron (see vercel.json), authenticated by the shared
 * cron secret since -- like aggregate-participation -- it reads across every
 * opted-in member's private step rows at once via the service-role client (see
 * src/lib/supabase/admin.ts).
 *
 * For each ACTIVE challenge it computes ONE aggregate row (team total +
 * counts), never an individual and never who opted in, applying the k-anon
 * FLOOR (below the minimum contributors the total is suppressed + stored as 0).
 *
 * SCALE + ROBUSTNESS (hardening): PostgREST caps every response at
 * `max_rows` (1000, see supabase/config.toml), returning a *silently truncated*
 * body, so every read here PAGES with `.range()` until a short page and
 * hard-fails on any error rather than aggregating a partial/empty set. The
 * per-member step read is chunked by user id (keeping the `in(...)` list — and
 * the request URL — small) so a KP-Snacks / Amazon-scale company aggregates
 * correctly instead of truncating to the first 1000 rows or 414-ing. A read
 * failure skips that ONE challenge (it stays `active` and retries next run)
 * rather than writing a bogus total or finalising it.
 */
const PAGE_SIZE = 1000;
const USER_CHUNK = 100; // ids per `in(...)` read -> small, safe URL length

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

/** Read every row of a query, paging past PostgREST's max_rows cap. Throws on
 *  any page error so the caller never aggregates a partial result. `makeQuery`
 *  must build a FRESH query each call (supabase-js builders aren't re-runnable)
 *  and MUST `.order()` on a unique column -- range paging without a total order
 *  can skip or duplicate rows across pages. */
async function fetchAll<T>(makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "query failed");
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicClient = createAdminClient();
  const privateClient = createAdminClient("private");

  let activeChallenges: {
    id: string;
    company_id: string;
    title: string;
    target_steps: number | string;
    starts_on: string;
    ends_on: string;
  }[];
  try {
    const all = await fetchAll<{
      id: string;
      company_id: string;
      title: string;
      target_steps: number | string;
      starts_on: string;
      ends_on: string;
    }>((from, to) =>
      publicClient
        .from("company_step_challenges")
        .select("id, company_id, title, target_steps, starts_on, ends_on")
        .eq("status", "active")
        .order("id")
        .range(from, to)
    );
    activeChallenges = all.filter((c) => c.company_id !== DIRECT_COMPANY_ID);
  } catch {
    return NextResponse.json({ error: "failed to load challenges" }, { status: 500 });
  }

  if (activeChallenges.length === 0) {
    return NextResponse.json({ ok: true, challengesProcessed: 0 });
  }

  const companyIds = Array.from(new Set(activeChallenges.map((c) => c.company_id)));

  // company_id -> its employee user_ids (paged; the result can exceed max_rows).
  const employeesByCompany = new Map<string, string[]>();
  const priorReached = new Map<string, boolean>();
  const hrAdminsByCompany = new Map<string, string[]>();
  try {
    const profiles = await fetchAll<{ id: string; company_id: string }>((from, to) =>
      publicClient.from("profiles").select("id, company_id").eq("role", "employee").in("company_id", companyIds).order("id").range(from, to)
    );
    for (const p of profiles) {
      if (!employeesByCompany.has(p.company_id)) employeesByCompany.set(p.company_id, []);
      employeesByCompany.get(p.company_id)!.push(p.id);
    }

    const challengeIds = activeChallenges.map((c) => c.id);
    const priorTotals = await fetchAll<{ challenge_id: string; target_reached: boolean }>((from, to) =>
      publicClient.from("company_step_totals").select("challenge_id, target_reached").in("challenge_id", challengeIds).order("challenge_id").range(from, to)
    );
    for (const r of priorTotals) priorReached.set(r.challenge_id, r.target_reached);

    const hrProfiles = await fetchAll<{ id: string; company_id: string }>((from, to) =>
      publicClient.from("profiles").select("id, company_id").eq("role", "hr_admin").in("company_id", companyIds).order("id").range(from, to)
    );
    for (const p of hrProfiles) {
      if (!hrAdminsByCompany.has(p.company_id)) hrAdminsByCompany.set(p.company_id, []);
      hrAdminsByCompany.get(p.company_id)!.push(p.id);
    }
  } catch {
    return NextResponse.json({ error: "failed to load company data" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const todayIso = now.slice(0, 10);
  const totalsRows = [];
  const targetHitNotices: { companyId: string; title: string; total: number; target: number }[] = [];
  const finalizations: { challengeId: string; completeUsers: string[]; mvp: string | null }[] = [];
  let challengesSkipped = 0;

  for (const challenge of activeChallenges) {
    try {
      const employees = employeesByCompany.get(challenge.company_id) ?? [];
      const headcount = employees.length;

      // Opt-OUTS only (default opted-in). Paged: a huge company could exceed max_rows.
      const optRows = await fetchAll<{ user_id: string; opted_in: boolean }>((from, to) =>
        privateClient.from("company_step_challenge_optins").select("user_id, opted_in").eq("challenge_id", challenge.id).order("id").range(from, to)
      );
      const optedOut = new Set(optRows.filter((r) => r.opted_in === false).map((r) => r.user_id));
      const optedInUsers = employees.filter((id) => !optedOut.has(id));
      const optedInCount = optedInUsers.length;

      // Sum each opted-in member's steps in the window. Chunk the id list so the
      // `in(...)` URL stays small, and page each chunk past max_rows. sumByUser is
      // kept so finalisation can pick the top contributor.
      const sumByUser = new Map<string, number>();
      for (let i = 0; i < optedInUsers.length; i += USER_CHUNK) {
        const batch = optedInUsers.slice(i, i + USER_CHUNK);
        const stepRows = await fetchAll<{ user_id: string; steps: number }>((from, to) =>
          privateClient
            .from("step_entries")
            .select("user_id, steps")
            .in("user_id", batch)
            .gte("entry_date", challenge.starts_on)
            .lte("entry_date", challenge.ends_on)
            .order("id")
            .range(from, to)
        );
        for (const row of stepRows) {
          sumByUser.set(row.user_id, (sumByUser.get(row.user_id) ?? 0) + row.steps);
        }
      }

      const result = computeStepTotals(Array.from(sumByUser.values()), Number(challenge.target_steps));
      totalsRows.push({
        challenge_id: challenge.id,
        company_id: challenge.company_id,
        total_steps: result.totalSteps,
        contributor_count: result.contributorCount,
        opted_in_count: optedInCount,
        headcount,
        target_reached: result.targetReached,
        suppressed: result.suppressed,
        updated_at: now,
      });

      // Transition to reached (and not suppressed) -> notify HR once.
      const wasReached = priorReached.get(challenge.id) ?? false;
      if (!wasReached && result.targetReached && !result.suppressed) {
        targetHitNotices.push({
          companyId: challenge.company_id,
          title: challenge.title,
          total: result.totalSteps,
          target: Number(challenge.target_steps),
        });
      }

      // Challenge-end finalisation (brief §3): award badges + mark completed.
      // Team MVP is the top contributor -- a PRIVATE own-rows-only award, and
      // gated on the k-anon floor (pickChallengeAwards) so challenge badges only
      // exist for real cohorts. Only queued when the reads above SUCCEEDED (we're
      // inside the try), so a failed read never finalises with missing data.
      if (challenge.ends_on < todayIso) {
        const awards = pickChallengeAwards(sumByUser.entries(), result.targetReached, result.suppressed);
        finalizations.push({ challengeId: challenge.id, completeUsers: awards.completeUsers, mvp: awards.mvp });
      }
    } catch {
      // Skip this ONE challenge: leave it 'active' (no bogus total, no finalise)
      // so it self-corrects on the next run rather than persisting a partial read.
      challengesSkipped += 1;
    }
  }

  // Persist the aggregates. If this fails, DON'T send notifications or finalise
  // (their once-only guards depend on the row being written), so nothing double-
  // fires next run.
  if (totalsRows.length > 0) {
    const { error } = await publicClient.from("company_step_totals").upsert(totalsRows, { onConflict: "challenge_id" });
    if (error) {
      return NextResponse.json({ error: "failed to persist totals", challengesSkipped }, { status: 500 });
    }
  }

  // Target-hit notifications to each company's HR admins -- aggregate figures
  // only. Best-effort: a send failure is counted, never thrown.
  let targetHitNotified = 0;
  for (const notice of targetHitNotices) {
    const hrIds = hrAdminsByCompany.get(notice.companyId) ?? [];
    if (hrIds.length === 0) continue;
    const { data: company } = await publicClient.from("companies").select("name").eq("id", notice.companyId).maybeSingle();
    const companyName = (company?.name as string) ?? "Your company";
    for (const hrId of hrIds) {
      const { data: userData } = await publicClient.auth.admin.getUserById(hrId);
      const email = userData?.user?.email;
      if (!email) continue;
      const ok = await sendTargetHitEmail({
        to: email,
        companyName,
        title: notice.title,
        totalSteps: notice.total,
        targetSteps: notice.target,
      });
      if (ok) targetHitNotified += 1;
    }
  }

  // Finalise ended challenges. Only flip to 'completed' once the badge awards
  // have been written -- otherwise leave it 'active' so a transient failure
  // retries next run rather than permanently denying everyone their badges.
  let challengesCompleted = 0;
  for (const fin of finalizations) {
    try {
      if (fin.completeUsers.length > 0) {
        const { error } = await privateClient
          .from("earned_badges")
          .upsert(
            fin.completeUsers.map((uid) => ({ user_id: uid, badge_key: "challenge_complete" })),
            { onConflict: "user_id,badge_key", ignoreDuplicates: true }
          );
        if (error) throw new Error(error.message);
      }
      if (fin.mvp) {
        const { error } = await privateClient
          .from("earned_badges")
          .upsert([{ user_id: fin.mvp, badge_key: "team_mvp" }], { onConflict: "user_id,badge_key", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      const { error } = await publicClient
        .from("company_step_challenges")
        .update({ status: "completed" })
        .eq("id", fin.challengeId)
        .eq("status", "active");
      if (error) throw new Error(error.message);
      challengesCompleted += 1;
    } catch {
      // leave 'active' -> retry next run
    }
  }

  return NextResponse.json({
    ok: true,
    challengesProcessed: totalsRows.length,
    challengesSkipped,
    targetHitNotified,
    challengesCompleted,
  });
}
