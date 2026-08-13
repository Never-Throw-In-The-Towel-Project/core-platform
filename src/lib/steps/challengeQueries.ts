import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// The staff-facing reads for the company step challenge. Everything a member
// sees is the AGGREGATE (company_step_totals) plus the challenge meta and their
// OWN opt-in state -- never another member's steps or opt-in. RLS enforces all
// of this; the explicit filters keep the queries honest and indexable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any>;

export interface StaffChallenge {
  id: string;
  title: string;
  target_steps: number;
  reward_type: string;
  reward_name: string;
  starts_on: string;
  ends_on: string;
  status: string;
}

export interface StaffChallengeTotals {
  total_steps: number;
  contributor_count: number;
  opted_in_count: number;
  headcount: number;
  target_reached: boolean;
  /** True while below the k-anon floor -- the team total is hidden, not shown. */
  suppressed: boolean;
}

export interface StaffChallengeView {
  challenge: StaffChallenge;
  companyName: string;
  /** The aggregate row, or null until the job has run for this challenge. */
  totals: StaffChallengeTotals | null;
  /** The member's OWN opt-in state; default true (opted in) when unset. */
  optedIn: boolean;
}

export interface AdminChallengeView {
  challenge: StaffChallenge;
  /** The aggregate row, or null until the job has run for this challenge. */
  totals: StaffChallengeTotals | null;
}

function mapChallenge(row: Record<string, unknown>): StaffChallenge {
  return {
    id: row.id as string,
    title: row.title as string,
    target_steps: Number(row.target_steps),
    reward_type: row.reward_type as string,
    reward_name: row.reward_name as string,
    starts_on: row.starts_on as string,
    ends_on: row.ends_on as string,
    status: row.status as string,
  };
}

function mapTotals(row: Record<string, unknown> | null): StaffChallengeTotals | null {
  if (!row) return null;
  return {
    total_steps: Number(row.total_steps),
    contributor_count: row.contributor_count as number,
    opted_in_count: row.opted_in_count as number,
    headcount: row.headcount as number,
    target_reached: row.target_reached as boolean,
    suppressed: row.suppressed as boolean,
  };
}

/**
 * The HR-admin view of their company's active challenge + the team aggregate.
 * Reads only the aggregate (never an individual, never who opted in) via the
 * hr_admin read policies. Returns null when the company has no active challenge.
 */
export async function getAdminChallengeView(
  publicClient: AnyClient,
  companyId: string
): Promise<AdminChallengeView | null> {
  const { data: challenge } = await publicClient
    .from("company_step_challenges")
    .select("id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();
  if (!challenge) return null;

  const { data: totals } = await publicClient
    .from("company_step_totals")
    .select("total_steps, contributor_count, opted_in_count, headcount, target_reached, suppressed")
    .eq("challenge_id", challenge.id)
    .maybeSingle();

  return { challenge: mapChallenge(challenge), totals: mapTotals(totals) };
}

/** The member's company's active challenge (id + title only), for entry points. */
export async function getActiveChallengeBrief(
  publicClient: AnyClient,
  companyId: string
): Promise<{ id: string; title: string } | null> {
  const { data } = await publicClient
    .from("company_step_challenges")
    .select("id, title")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();
  return data ? { id: data.id as string, title: data.title as string } : null;
}

/**
 * The full staff challenge view: the active challenge for the member's company,
 * the team aggregate, and the member's own opt-in. Returns null when the company
 * has no active challenge. `target_steps`/`total_steps` are coerced to numbers
 * (they are bigints in the DB but well within JS-safe range for step counts).
 */
export async function getActiveStaffChallenge(
  publicClient: AnyClient,
  privateClient: AnyClient,
  userId: string,
  companyId: string
): Promise<StaffChallengeView | null> {
  const { data: challenge } = await publicClient
    .from("company_step_challenges")
    .select("id, title, target_steps, reward_type, reward_name, starts_on, ends_on, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();
  if (!challenge) return null;

  const [{ data: company }, { data: totals }, { data: optin }] = await Promise.all([
    publicClient.from("companies").select("name").eq("id", companyId).maybeSingle(),
    publicClient
      .from("company_step_totals")
      .select("total_steps, contributor_count, opted_in_count, headcount, target_reached, suppressed")
      .eq("challenge_id", challenge.id)
      .maybeSingle(),
    privateClient
      .from("company_step_challenge_optins")
      .select("opted_in")
      .eq("user_id", userId)
      .eq("challenge_id", challenge.id)
      .maybeSingle(),
  ]);

  return {
    challenge: {
      id: challenge.id as string,
      title: challenge.title as string,
      target_steps: Number(challenge.target_steps),
      reward_type: challenge.reward_type as string,
      reward_name: challenge.reward_name as string,
      starts_on: challenge.starts_on as string,
      ends_on: challenge.ends_on as string,
      status: challenge.status as string,
    },
    companyName: (company?.name as string) ?? "",
    totals: totals
      ? {
          total_steps: Number(totals.total_steps),
          contributor_count: totals.contributor_count as number,
          opted_in_count: totals.opted_in_count as number,
          headcount: totals.headcount as number,
          target_reached: totals.target_reached as boolean,
          suppressed: totals.suppressed as boolean,
        }
      : null,
    optedIn: optin ? (optin.opted_in as boolean) : true,
  };
}
