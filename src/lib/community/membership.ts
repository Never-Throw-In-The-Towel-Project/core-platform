import { DIRECT_COMPANY_ID } from "@/lib/tenant/constants";
import type { Profile } from "@/types/database";

/**
 * Whether a user belongs to a real company organisation -- a partner company
 * whose staff can have a shared, private community space. Two "companies" are
 * NOT organisations in that sense:
 *   - the shared NTITT-Direct pool, which every self-signup individual joins
 *     (a company feed there would pool unrelated strangers), and
 *   - the synthetic "NTITT (internal)" row that exists only to satisfy an
 *     ntitt_admin's NOT NULL company_id (see migration 20260731020000) --
 *     platform operators aren't a client company.
 *
 * Only company-org members get the "My Company" community tab/space; everyone
 * else sees just the global feed, the Wins Board and the guidelines.
 */
export function isCompanyOrgMember(profile: Pick<Profile, "company_id" | "role">): boolean {
  return profile.role !== "ntitt_admin" && profile.company_id !== DIRECT_COMPANY_ID;
}
