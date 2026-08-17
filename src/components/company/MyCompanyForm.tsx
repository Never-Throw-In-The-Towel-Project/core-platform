"use client";

import { useActionState, useState } from "react";
import { updateMyCompany } from "@/lib/actions/companyAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";

export type MyCompany = {
  welcome_copy: string | null;
  support_contact_name: string | null;
  support_contact_email: string | null;
  support_contact_phone: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

// The picker's starting accent when a company is switching from defaults to
// custom (matches the NewCompanyWizard default). Primary's starting value is
// passed in as the real NTITT skin colour so "custom" begins where "default"
// left off.
const ACCENT_START = "#ff563c";

/**
 * HR edits their own company's member-facing settings (updateMyCompany derives
 * the company from the caller's profile, so there's no companyId field here).
 * Name and slug are NOT editable -- they're NTITT-owned portal identity.
 *
 * Brand colours are a TRUE tri-state: a company with NULL colours follows the
 * NTITT defaults (getCompanySkin -> DEFAULT_SKIN; ThemeProvider leaves
 * --brand-accent alone). A plain `<input type="color">` can't represent "unset"
 * -- it always submits a value -- so without the explicit "use defaults"
 * checkbox, saving the form (e.g. after only editing the welcome copy) would
 * silently stamp the placeholder colours over the NULLs and flip the members'
 * skin. The checkbox writes NULLs back when ticked, and only sends the picked
 * colours when the admin has deliberately chosen custom ones.
 */
export function MyCompanyForm({
  company,
  defaultPrimaryColor,
}: {
  company: MyCompany;
  /** The NTITT default skin colour (DEFAULT_SKIN), used as the primary picker's
   *  starting point when a company switches from defaults to custom. */
  defaultPrimaryColor: string;
}) {
  const [state, formAction, isPending] = useActionState(updateMyCompany, initialRoutineState);
  const [useDefaultColours, setUseDefaultColours] = useState(
    company.primary_color == null && company.accent_color == null
  );

  return (
    <form action={formAction} className="space-y-4 border border-rule-hairline p-5">
      <label className="block text-sm">
        Welcome copy
        <textarea
          name="welcomeCopy"
          maxLength={2000}
          rows={3}
          defaultValue={company.welcome_copy ?? ""}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">
          Shown to your team on their sign-in page. Optional.
        </span>
      </label>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">Support contact</legend>
        <p className="text-xs text-muted">
          Where your team&apos;s &ldquo;Ask for Support&rdquo; alerts are routed.
        </p>
        <label className="block text-sm">
          Name
          <input
            name="supportContactName"
            type="text"
            maxLength={120}
            defaultValue={company.support_contact_name ?? ""}
            className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1 text-sm">
            Email
            <input
              name="supportContactEmail"
              type="email"
              defaultValue={company.support_contact_email ?? ""}
              className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="block flex-1 text-sm">
            Phone
            <input
              name="supportContactPhone"
              type="tel"
              maxLength={40}
              defaultValue={company.support_contact_phone ?? ""}
              className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">Brand colours</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="useDefaultColours"
            checked={useDefaultColours}
            onChange={(e) => setUseDefaultColours(e.target.checked)}
            className="h-4 w-4"
          />
          Use the NTITT default colours
        </label>
        {!useDefaultColours && (
          <div className="flex gap-4">
            <label className="text-sm">
              Primary
              <input
                name="primaryColor"
                type="color"
                defaultValue={company.primary_color ?? defaultPrimaryColor}
                className="mt-1 block h-9 w-16 border border-rule-border bg-transparent"
              />
            </label>
            <label className="text-sm">
              Accent
              <input
                name="accentColor"
                type="color"
                defaultValue={company.accent_color ?? ACCENT_START}
                className="mt-1 block h-9 w-16 border border-rule-border bg-transparent"
              />
            </label>
          </div>
        )}
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
