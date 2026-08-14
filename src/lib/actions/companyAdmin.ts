"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVED_SUBDOMAINS } from "@/lib/tenant/resolve";
import { type RoutineActionState } from "./routineState";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Subdomain-safe: lowercase letters, digits and internal hyphens (no leading/
// trailing hyphen). This becomes {slug}.ntitt.co.uk.
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const optionalHex = z.union([z.string().trim().regex(HEX_COLOR, "Use a #RRGGBB colour."), z.literal("")]).optional();

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1, "Enter a company name.").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a slug.")
    .max(63)
    .regex(SLUG, "Slug: lowercase letters, numbers and hyphens only.")
    .refine((s) => !RESERVED_SUBDOMAINS.has(s), "That subdomain is reserved -- pick another slug."),
  supportContactName: z.string().trim().max(120).optional(),
  supportContactEmail: z.union([z.email(), z.literal("")]).optional(),
  supportContactPhone: z.string().trim().max(40).optional(),
  primaryColor: optionalHex,
  accentColor: optionalHex,
});

/**
 * ntitt_admin-only: create a client company so staff can then be invited into
 * it -- the one thing that previously required hand-written SQL. companies has
 * no INSERT RLS policy (it's public-read only), so this writes through the
 * service-role client AFTER requireNtittAdmin(), the same trust model as
 * inviteStaffMember. The slug is the company's {slug}.ntitt.co.uk subdomain and
 * must be unique; DNS/Vercel domain wiring for a co-branded subdomain is a
 * separate ops step (a client on the default app.ntitt.co.uk needs only a
 * unique slug). Colours/support-contact are optional -- an un-branded company
 * simply uses the default NTITT theme.
 */
export async function createCompany(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = CreateCompanySchema.safeParse({
    name: formData.get("name"),
    // Normalise case up front so "Acme" and "acme" can't both be created.
    slug: (formData.get("slug") ?? "").toString().trim().toLowerCase(),
    supportContactName: formData.get("supportContactName") ?? undefined,
    supportContactEmail: formData.get("supportContactEmail") ?? undefined,
    supportContactPhone: formData.get("supportContactPhone") ?? undefined,
    primaryColor: formData.get("primaryColor") ?? undefined,
    accentColor: formData.get("accentColor") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const d = parsed.data;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("companies").insert({
      name: d.name,
      slug: d.slug,
      support_contact_name: d.supportContactName || null,
      support_contact_email: d.supportContactEmail || null,
      support_contact_phone: d.supportContactPhone || null,
      primary_color: d.primaryColor || null,
      accent_color: d.accentColor || null,
    });
    if (error) {
      // 23505 = unique violation (slug or custom_domain already taken).
      if (error.code === "23505") {
        return { status: "error", message: "That slug is already taken — choose another." };
      }
      return { status: "error", message: "Couldn't create the company. Please try again." };
    }
  } catch {
    return { status: "error", message: "Couldn't create the company. Please try again." };
  }

  // So the new company appears immediately in the invite form's dropdown.
  revalidatePath("/admin/companies");
  return { status: "success", message: `Created “${d.name}”. You can now invite staff into it below.` };
}
