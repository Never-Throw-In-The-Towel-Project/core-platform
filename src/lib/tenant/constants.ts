/**
 * Stable id of the shared "direct" company row every public/self-service
 * signup (src/lib/actions/signup.ts) is assigned to -- see
 * supabase/migrations/20260807000000_direct_company_seed.sql. Keep this
 * literal in sync with that migration's insert by hand -- there's no shared
 * schema/codegen between SQL and this file.
 */
export const DIRECT_COMPANY_ID = "00000000-0000-0000-0000-000000000001";
