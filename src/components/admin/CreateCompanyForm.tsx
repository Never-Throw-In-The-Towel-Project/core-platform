"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompany } from "@/lib/actions/companyAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";

/**
 * ntitt_admin-only: create a client company. Name + slug are required; the rest
 * (support contact, brand colours) are optional and can be filled later. On
 * success the form resets and the new company appears in the invite dropdown
 * below (both are on the same page, which revalidates).
 */
export function CreateCompanyForm() {
  const [state, formAction, isPending] = useActionState(createCompany, initialRoutineState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-black/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Create a company</h2>
        <p className="mt-1 text-xs opacity-60">
          Sets up a new client company so you can invite its staff. Only the name and slug are required.
        </p>
      </div>

      <label className="block text-sm">
        Company name
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Slug
        <input
          name="slug"
          type="text"
          required
          maxLength={63}
          pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?"
          placeholder="acme-corp"
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
        <span className="mt-1 block text-xs opacity-60">
          Lowercase letters, numbers and hyphens. Reserved for a co-branded{" "}
          <code>slug.ntitt.co.uk</code> subdomain (DNS is set up separately); a client on the default
          domain just needs a unique value.
        </span>
      </label>

      <fieldset className="space-y-3 border-t border-black/10 pt-3">
        <legend className="text-xs font-semibold opacity-70">Support contact (optional)</legend>
        <p className="text-xs opacity-60">Where this company&apos;s &ldquo;Ask for Support&rdquo; alerts route. Can be set later.</p>
        <label className="block text-sm">
          Name
          <input name="supportContactName" type="text" maxLength={120} className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2" />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1 text-sm">
            Email
            <input name="supportContactEmail" type="email" className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2" />
          </label>
          <label className="block flex-1 text-sm">
            Phone
            <input name="supportContactPhone" type="tel" maxLength={40} className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-black/10 pt-3">
        <legend className="text-xs font-semibold opacity-70">Brand colours (optional)</legend>
        <p className="text-xs opacity-60">Leave blank to use the default NTITT theme.</p>
        <div className="flex gap-4">
          <label className="text-sm">
            Primary
            <input name="primaryColor" type="color" defaultValue="#111111" className="mt-1 block h-9 w-16 rounded-md border border-black/20 bg-transparent" />
          </label>
          <label className="text-sm">
            Accent
            <input name="accentColor" type="color" defaultValue="#ff563c" className="mt-1 block h-9 w-16 rounded-md border border-black/20 bg-transparent" />
          </label>
        </div>
        <p className="text-xs opacity-50">
          Tip: to keep the default theme, don&apos;t change these — an unset colour uses NTITT&apos;s.
        </p>
      </fieldset>

      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
      {state.status === "success" && <p className="text-sm font-medium text-green-700">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
