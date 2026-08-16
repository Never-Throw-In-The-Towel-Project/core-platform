import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SuperAdmin = { id: string; displayName: string; email: string | null };

/**
 * Every ntitt_admin, with their sign-in email, for the /admin/settings "current
 * super admins" list. Read through the service-role client: `profiles` is
 * own-row-read only under RLS, and the email lives in auth.users (not on the
 * profile), reachable only via the Admin API. Super admins are a handful of
 * people, so a getUserById per row is fine and avoids listUsers pagination.
 * Best-effort per row: a lookup failure yields a null email, never a throw, so
 * one bad row can't blank the whole list.
 */
export async function listSuperAdmins(): Promise<SuperAdmin[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("role", "ntitt_admin")
    .order("display_name", { ascending: true });
  if (error || !data) return [];

  const rows = data as { id: string; display_name: string }[];
  return Promise.all(
    rows.map(async (row) => {
      let email: string | null = null;
      try {
        const { data: user } = await admin.auth.admin.getUserById(row.id);
        email = user.user?.email ?? null;
      } catch {
        email = null;
      }
      return { id: row.id, displayName: row.display_name, email };
    })
  );
}
