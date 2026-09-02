import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// The default NTITT skin colour when a company has none set (the brief's table
// lists NTITT itself as #ec3013). Only ever colours the top strip and the header
// chip -- never the accent.
export const DEFAULT_SKIN = "#ec3013";

/**
 * The signed-in user's company name + skin colour for the app header chip and
 * top strip. `companies` is public-readable (see lib/tenant/resolve.ts), so the
 * session client is enough. Defensive: any failure degrades to the NTITT default
 * rather than blocking the screen. Shared by the (app) layout and the adaptive
 * Events layout.
 *
 * Wrapped in React's `cache()` so a layout and any nested layout/page that both
 * need the same company's skin in one request share a single DB round-trip
 * (keyed on companyId), rather than each issuing its own -- the same per-request
 * dedup the auth DAL uses for the profile lookup.
 */
export const getCompanySkin = cache(
  async (companyId: string): Promise<{ name: string; skinColor: string }> => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("companies")
        .select("name, primary_color")
        .eq("id", companyId)
        .maybeSingle();
      return {
        name: data?.name ?? "NTITT",
        skinColor: data?.primary_color ?? DEFAULT_SKIN,
      };
    } catch {
      return { name: "NTITT", skinColor: DEFAULT_SKIN };
    }
  }
);
