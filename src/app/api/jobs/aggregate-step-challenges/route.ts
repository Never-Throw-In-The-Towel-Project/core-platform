import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/auth/cron";
import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import { computeStepTotals } from "@/lib/steps/challenge";

/**
 * The private -> public aggregation for the COMPANY STEP CHALLENGE (brief §2).
 * Runs daily via Vercel Cron (see vercel.json), authenticated by the shared
 * cron secret since -- like aggregate-participation -- it reads across every
 * opted-in member's private step rows at once via the service-role client (see
 * src/lib/supabase/admin.ts).
 *
 * For each ACTIVE challenge it computes ONE aggregate row (team total +
 * counts), never an individual and never who opted in:
 *   1. the company's employees (public.profiles) -> headcount + eligible set;
 *   2. explicit opt-OUTS (private.company_step_challenge_optins, opted_in=false)
 *      -- default is opted-in, so only opt-outs exclude a member;
 *   3. each opted-in member's step sum in the window (private.step_entries),
 *      summed per member IN MEMORY (no cross-schema join, PostgREST is
 *      single-schema per request);
 *   4. computeStepTotals() applies the k-anon FLOOR: below the minimum number of
 *      contributors the total is suppressed and stored as 0, so a small team's
 *      aggregate can never reveal one person's steps.
 * The upsert is idempotent per challenge_id, so every run recomputes from source
 * and overwrites the prior row. The shared self-signup pool is never processed
 * (also barred by a CHECK on the table -- defense in depth).
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicClient = createAdminClient();
  const privateClient = createAdminClient("private");

  const { data: challenges, error: challengesError } = await publicClient
    .from("company_step_challenges")
    .select("id, company_id, target_steps, starts_on, ends_on")
    .eq("status", "active");
  if (challengesError) {
    return NextResponse.json({ error: "failed to load challenges" }, { status: 500 });
  }

  const activeChallenges = (challenges ?? []).filter((c) => c.company_id !== DIRECT_COMPANY_ID);
  if (activeChallenges.length === 0) {
    return NextResponse.json({ ok: true, challengesProcessed: 0 });
  }

  // company_id -> its employee user_ids (headcount = list length).
  const companyIds = Array.from(new Set(activeChallenges.map((c) => c.company_id as string)));
  const { data: profiles, error: profilesError } = await publicClient
    .from("profiles")
    .select("id, company_id")
    .eq("role", "employee")
    .in("company_id", companyIds);
  if (profilesError || !profiles) {
    return NextResponse.json({ error: "failed to load profiles" }, { status: 500 });
  }
  const employeesByCompany = new Map<string, string[]>();
  for (const p of profiles) {
    const cid = p.company_id as string;
    if (!employeesByCompany.has(cid)) employeesByCompany.set(cid, []);
    employeesByCompany.get(cid)!.push(p.id as string);
  }

  const now = new Date().toISOString();
  const totalsRows = [];

  for (const challenge of activeChallenges) {
    const employees = employeesByCompany.get(challenge.company_id as string) ?? [];
    const headcount = employees.length;

    // Opt-OUTS only (default opted-in): a member is opted-in unless they have an
    // explicit opted_in=false row for this challenge.
    const { data: optRows } = await privateClient
      .from("company_step_challenge_optins")
      .select("user_id, opted_in")
      .eq("challenge_id", challenge.id);
    const optedOut = new Set(
      (optRows ?? []).filter((r) => r.opted_in === false).map((r) => r.user_id as string)
    );
    const optedInUsers = employees.filter((id) => !optedOut.has(id));
    const optedInCount = optedInUsers.length;

    // Sum each opted-in member's steps within the window. Service-role read of
    // private.step_entries; summed per member in memory, never exposed per-row.
    let memberSums: number[] = [];
    if (optedInUsers.length > 0) {
      const { data: stepRows } = await privateClient
        .from("step_entries")
        .select("user_id, steps")
        .in("user_id", optedInUsers)
        .gte("entry_date", challenge.starts_on)
        .lte("entry_date", challenge.ends_on);
      const sumByUser = new Map<string, number>();
      for (const row of stepRows ?? []) {
        const uid = row.user_id as string;
        sumByUser.set(uid, (sumByUser.get(uid) ?? 0) + (row.steps as number));
      }
      memberSums = Array.from(sumByUser.values());
    }

    const result = computeStepTotals(memberSums, Number(challenge.target_steps));
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
  }

  if (totalsRows.length > 0) {
    await publicClient
      .from("company_step_totals")
      .upsert(totalsRows, { onConflict: "challenge_id" });
  }

  return NextResponse.json({ ok: true, challengesProcessed: totalsRows.length });
}
