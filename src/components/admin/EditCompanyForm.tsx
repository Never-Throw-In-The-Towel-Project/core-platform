"use client";

import { useActionState } from "react";
import { updateCompany } from "@/lib/actions/companyAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";

export type EditableCompany = {
  id: string;
  name: string;
  slug: string;
  welcome_copy: string | null;
  support_contact_name: string | null;
  support_contact_email: string | null;
  support_contact_phone: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

/**
 * Edit an existing company's branding / welcome copy / support contacts. Fields
 * are uncontrolled (defaultValue) prefills; the slug is shown read-only above
 * this form (it's the portal identity and never editable -- see updateCompany).
 */
export function EditCompanyForm({ company }: { company: EditableCompany }) {
  const [state, formAction, isPending] = useActionState(updateCompany, initialRoutineState);

  return (
    <form action={formAction} className="space-y-4 border border-rule-hairline p-5">
      <input type="hidden" name="companyId" value={company.id} />

      <label className="block text-sm">
        Company name
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={company.name}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Welcome copy
        <textarea
          name="welcomeCopy"
          maxLength={2000}
          rows={3}
          defaultValue={company.welcome_copy ?? ""}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">Shown to this company&apos;s members. Optional.</span>
      </label>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">Support contact</legend>
        <p className="text-xs text-muted">Where this company&apos;s &ldquo;Ask for Support&rdquo; alerts route.</p>
        <label className="block text-sm">
          Name
          <input name="supportContactName" type="text" maxLength={120} defaultValue={company.support_contact_name ?? ""} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1 text-sm">
            Email
            <input name="supportContactEmail" type="email" defaultValue={company.support_contact_email ?? ""} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
          </label>
          <label className="block flex-1 text-sm">
            Phone
            <input name="supportContactPhone" type="tel" maxLength={40} defaultValue={company.support_contact_phone ?? ""} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">Brand colours</legend>
        <div className="flex gap-4">
          <label className="text-sm">
            Primary
            <input name="primaryColor" type="color" defaultValue={company.primary_color ?? "#111111"} className="mt-1 block h-9 w-16 border border-rule-border bg-transparent" />
          </label>
          <label className="text-sm">
            Accent
            <input name="accentColor" type="color" defaultValue={company.accent_color ?? "#ff563c"} className="mt-1 block h-9 w-16 border border-rule-border bg-transparent" />
          </label>
        </div>
      </fieldset>

      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && <p className="text-sm font-medium text-foreground">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
