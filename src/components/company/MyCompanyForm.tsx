"use client";

import { useActionState } from "react";
import { updateMyCompany } from "@/lib/actions/companyAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";
import { BrandColourFields } from "@/components/brand/BrandColourFields";

export type MyCompany = {
  welcome_copy: string | null;
  support_contact_name: string | null;
  support_contact_email: string | null;
  support_contact_phone: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

/**
 * HR edits their own company's member-facing settings (updateMyCompany derives
 * the company from the caller's profile, so there's no companyId field here).
 * Name and slug are NOT editable -- they're NTITT-owned portal identity. Brand
 * colours are handled by the shared BrandColourFields (a NULL-preserving
 * tri-state).
 */
export function MyCompanyForm({
  company,
  defaultPrimaryColor,
}: {
  company: MyCompany;
  /** The NTITT default skin colour (DEFAULT_SKIN), forwarded to BrandColourFields. */
  defaultPrimaryColor: string;
}) {
  const [state, formAction, isPending] = useActionState(updateMyCompany, initialRoutineState);

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

      <BrandColourFields
        initialPrimary={company.primary_color}
        initialAccent={company.accent_color}
        defaultPrimaryColor={defaultPrimaryColor}
      />

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
