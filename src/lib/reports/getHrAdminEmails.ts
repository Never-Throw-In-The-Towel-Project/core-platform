import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `companies.support_contact_email` is who Ask for Support alerts route to
 * (Anthony, a first-aider, or both) -- not necessarily the HR admin who
 * manages the dashboard. The HR admin's email lives on their auth.users
 * row, not on profiles/companies, so this needs the service-role admin API
 * (auth.admin.getUserById) rather than a plain table query.
 */
export async function getHrAdminEmails(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "hr_admin");

  if (!admins || admins.length === 0) return [];

  const emails: string[] = [];
  for (const admin of admins) {
    const { data } = await supabase.auth.admin.getUserById(admin.id);
    if (data?.user?.email) emails.push(data.user.email);
  }
  return emails;
}
