"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import { dispatchSupportAlert } from "@/lib/support/alert";
import type { Company } from "@/types/database";

const SupportRequestSchema = z.object({
  stayAnonymous: z.boolean(),
  displayName: z.string().max(100).optional(),
  urgency: z.enum(["check_in", "talk_today", "urgent"]),
  contactMethod: z.string().max(200).optional(),
});

export type SupportActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function submitSupportRequest(
  _prevState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  // Every screen shows this button, but submitting still requires a session
  // -- "Ask for Support" identifies a real platform user internally (even
  // when they choose to appear anonymous to the responder), it is not an
  // open unauthenticated form.
  //
  // companyId always comes from the caller's own profile, never a
  // client-submitted value -- previously this trusted a hidden form field,
  // which let a tampered request pollute another company's support-count
  // KPI and route the Twilio/email alert to a different company's real
  // contact. Same defense-in-depth pattern as inviteEmployee
  // (lib/actions/invite.ts).
  const profile = await getProfile();

  const parsed = SupportRequestSchema.safeParse({
    stayAnonymous: formData.get("stayAnonymous") === "true",
    displayName: formData.get("displayName") || undefined,
    urgency: formData.get("urgency"),
    contactMethod: formData.get("contactMethod") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const companyId = profile.company_id;
  const { stayAnonymous, displayName, urgency, contactMethod } = parsed.data;
  const contactDisplayName = stayAnonymous ? null : displayName?.trim() || null;

  // Wrapped in try/catch: createClient() throws synchronously if the
  // URL/key are missing or malformed (node_modules/@supabase/ssr/dist/main/
  // createServerClient.js), same gap already closed elsewhere -- this is the
  // "Ask for Support" submit specifically, so an unrecognized failure here
  // is worse than most: it took the user to Next's generic error page
  // instead of this form's own "call the helpline if this is urgent."
  // fallback, right when they may be relying on that number.
  let request: { id: string } | null = null;
  try {
    const privateClient = await createClient("private");
    const { data, error: insertError } = await privateClient
      .from("support_requests")
      .insert({
        user_id: profile.id,
        company_id: companyId,
        contact_display_name: contactDisplayName,
        urgency,
        contact_method: contactMethod ?? null,
      })
      .select("id")
      .single();
    if (!insertError && data) {
      request = data;
    }
  } catch {
    request = null;
  }

  if (!request) {
    return {
      status: "error",
      message: "Something went wrong submitting this. Please call the helpline if this is urgent.",
    };
  }

  // Look up where to route the alert. The support_contact_* columns are no
  // longer readable by the RLS session (`authenticated`) client -- they were
  // world-readable via the anon key before
  // 20260810020000_restrict_company_contact_columns.sql restricted them to
  // service_role. So this read uses the admin client. That's the correct
  // client for it anyway: this is staff routing info, not the user's own
  // private data, and the admin client already handles every other
  // support_contact_* read (the Twilio webhook and both cron jobs).
  //
  // Wrapped the same way as the insert above, but a failure here degrades
  // rather than fails the action outright: the support request is already
  // saved by this point, so a throw just means "skip the alert dispatch"
  // the same way an already-handled "company not found" does below, not
  // "tell the user their submission failed" -- it didn't.
  let company: Pick<
    Company,
    "name" | "support_contact_name" | "support_contact_phone" | "support_contact_email"
  > | null = null;
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("companies")
      .select("name, support_contact_name, support_contact_phone, support_contact_email")
      .eq("id", companyId)
      .single();
    company = data;
  } catch {
    company = null;
  }

  if (company) {
    const deliveryStatus = await dispatchSupportAlert({
      requestId: request.id,
      company,
      contactDisplayName,
      urgency,
      contactMethod: contactMethod ?? null,
    });

    // Best-effort status update on an already-saved request -- same
    // reasoning as the company lookup above, a throw here shouldn't fail
    // the action the user already got a success response for.
    try {
      const privateClient = await createClient("private");
      await privateClient
        .from("support_requests")
        .update({ delivery_status: deliveryStatus })
        .eq("id", request.id);
    } catch {
      // best-effort; the request itself is already saved
    }
  }

  return { status: "success" };
}
