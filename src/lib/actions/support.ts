"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/auth/dal";
import { dispatchSupportAlert } from "@/lib/support/alert";
import type { Company } from "@/types/database";

const SupportRequestSchema = z.object({
  companyId: z.string().uuid(),
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
  const session = await verifySession();

  const parsed = SupportRequestSchema.safeParse({
    companyId: formData.get("companyId"),
    stayAnonymous: formData.get("stayAnonymous") === "true",
    displayName: formData.get("displayName") || undefined,
    urgency: formData.get("urgency"),
    contactMethod: formData.get("contactMethod") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  const { companyId, stayAnonymous, displayName, urgency, contactMethod } = parsed.data;
  const contactDisplayName = stayAnonymous ? null : displayName?.trim() || null;

  const supabase = await createClient();

  const { data: request, error: insertError } = await supabase
    .from("support_requests")
    .insert({
      user_id: session.userId,
      company_id: companyId,
      contact_display_name: contactDisplayName,
      urgency,
      contact_method: contactMethod ?? null,
    })
    .select("id")
    .single();

  if (insertError || !request) {
    return {
      status: "error",
      message: "Something went wrong submitting this. Please call the helpline if this is urgent.",
    };
  }

  // Look up where to route the alert. Company support-contact routing info
  // is not sensitive (it's staff contact details, not a user's private
  // data), so the regular RLS-scoped client is fine here -- no admin client
  // needed for this read.
  const { data: company } = await supabase
    .from("companies")
    .select("name, support_contact_name, support_contact_phone, support_contact_email")
    .eq("id", companyId)
    .single();

  if (company) {
    const deliveryStatus = await dispatchSupportAlert({
      requestId: request.id,
      company: company as Pick<
        Company,
        "name" | "support_contact_name" | "support_contact_phone" | "support_contact_email"
      >,
      contactDisplayName,
      urgency,
      contactMethod: contactMethod ?? null,
    });

    await supabase
      .from("support_requests")
      .update({ delivery_status: deliveryStatus })
      .eq("id", request.id);
  }

  return { status: "success" };
}
