"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionInvite } from "@/lib/invite/provision";
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

const CreateCompanyWithHrSchema = CreateCompanySchema.extend({
  hrName: z.string().trim().min(1, "Enter the HR admin's name.").max(80),
  hrEmail: z.email("Enter a valid email for the HR admin."),
});

/**
 * The self-serve "New Company" wizard (docs/PLATFORM_STRUCTURE.md): create the
 * company AND invite its first HR admin in one step, so NTITT can stand up a
 * live, branded partner portal with no engineering/DNS support -- the
 * *.ntitt.co.uk wildcard makes the {slug}.ntitt.co.uk subdomain resolve
 * automatically the moment the row exists.
 *
 * If the company insert succeeds but the HR invite fails, the company is kept
 * (it's valid) and the admin is told to invite the HR admin from the staff form
 * -- a half-made company is recoverable; a rolled-back one loses the branding
 * they just entered.
 */
export async function createCompanyWithHr(
  _prevState: RoutineActionState,
  formData: FormData
): Promise<RoutineActionState> {
  await requireNtittAdmin();

  const parsed = CreateCompanyWithHrSchema.safeParse({
    name: formData.get("name"),
    slug: (formData.get("slug") ?? "").toString().trim().toLowerCase(),
    supportContactName: formData.get("supportContactName") ?? undefined,
    supportContactEmail: formData.get("supportContactEmail") ?? undefined,
    supportContactPhone: formData.get("supportContactPhone") ?? undefined,
    primaryColor: formData.get("primaryColor") ?? undefined,
    accentColor: formData.get("accentColor") ?? undefined,
    hrName: formData.get("hrName"),
    hrEmail: formData.get("hrEmail"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const d = parsed.data;

  let companyId: string;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("companies")
      .insert({
        name: d.name,
        slug: d.slug,
        support_contact_name: d.supportContactName || null,
        support_contact_email: d.supportContactEmail || null,
        support_contact_phone: d.supportContactPhone || null,
        primary_color: d.primaryColor || null,
        accent_color: d.accentColor || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        return { status: "error", message: "That slug is already taken — choose another." };
      }
      return { status: "error", message: "Couldn't create the company. Please try again." };
    }
    companyId = data.id;
  } catch {
    return { status: "error", message: "Couldn't create the company. Please try again." };
  }

  const invite = await provisionInvite({
    email: d.hrEmail,
    displayName: d.hrName,
    companyId,
    role: "hr_admin",
  });

  revalidatePath("/admin/companies");

  if (!invite.ok) {
    return {
      status: "error",
      message: `Created “${d.name}”, but the HR invite failed: ${invite.message} Invite them from “Add staff” below.`,
    };
  }

  const root = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "ntitt.co.uk";
  return {
    status: "success",
    message: `Created “${d.name}” — portal live at ${d.slug}.${root}, and invited ${d.hrEmail} as HR admin.`,
  };
}
