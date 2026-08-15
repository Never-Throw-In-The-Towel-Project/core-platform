"use client";

import { useActionState, useState } from "react";
import { createCompanyWithHr } from "@/lib/actions/companyAdmin";
import { initialRoutineState } from "@/lib/actions/routineState";

// NEXT_PUBLIC_* is inlined at build, so the live URL preview needs no round-trip.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "neverthrowinthetowel.uk";

// Mirror of the server-side SLUG rule (companyAdmin.ts) so the preview matches
// what will actually be created.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * The stateful fields. Kept as a child so the parent can reset the whole form
 * after a successful create by remounting it with a fresh `key` -- the
 * idiomatic reset (no setState-in-effect). Name drives the slug + live URL
 * preview until the admin edits the slug directly.
 */
function WizardFields() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <>
      <label className="block text-sm">
        Company name
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
        />
      </label>

      <div className="block text-sm">
        Portal address
        <div className="mt-1 flex items-center border border-rule-border">
          <input
            name="slug"
            type="text"
            required
            maxLength={63}
            pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?"
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugEdited(true);
            }}
            className="w-full bg-transparent px-3 py-2"
            aria-label="Portal subdomain"
          />
          <span className="whitespace-nowrap px-3 text-sm text-muted">.{ROOT_DOMAIN}</span>
        </div>
        <span className="mt-1 block text-xs text-muted">
          {effectiveSlug ? (
            <>
              Portal will be live at{" "}
              <code className="font-semibold text-foreground">
                {effectiveSlug}.{ROOT_DOMAIN}
              </code>
            </>
          ) : (
            "Auto-filled from the company name; edit if you like."
          )}
        </span>
      </div>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">First HR admin</legend>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1 text-sm">
            Name
            <input name="hrName" type="text" required maxLength={80} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
          </label>
          <label className="block flex-1 text-sm">
            Email
            <input name="hrEmail" type="email" required className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
          </label>
        </div>
        <p className="text-xs text-muted">They&apos;ll get an email invite to set a password and land in their Workspace.</p>
      </fieldset>

      <fieldset className="space-y-3 border-t border-rule-hairline pt-3">
        <legend className="text-xs font-semibold text-muted">Brand colours (optional)</legend>
        <div className="flex gap-4">
          <label className="text-sm">
            Primary
            <input name="primaryColor" type="color" defaultValue="#111111" className="mt-1 block h-9 w-16 border border-rule-border bg-transparent" />
          </label>
          <label className="text-sm">
            Accent
            <input name="accentColor" type="color" defaultValue="#ff563c" className="mt-1 block h-9 w-16 border border-rule-border bg-transparent" />
          </label>
        </div>
        <p className="text-xs text-muted">Leave as-is to use the default NTITT theme.</p>
      </fieldset>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted">Support contact (optional)</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Name
            <input name="supportContactName" type="text" maxLength={120} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="block flex-1 text-sm">
              Email
              <input name="supportContactEmail" type="email" className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
            </label>
            <label className="block flex-1 text-sm">
              Phone
              <input name="supportContactPhone" type="tel" maxLength={40} className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2" />
            </label>
          </div>
        </div>
      </details>
    </>
  );
}

/**
 * The self-serve "New Company" wizard: type a name and the portal address +
 * live URL preview fill themselves in; enter the first HR admin; submit creates
 * the company AND sends the HR invite in one step (createCompanyWithHr). No
 * DNS, no engineering -- the wildcard subdomain resolves the moment the row
 * exists.
 */
export function NewCompanyWizard() {
  const [state, formAction, isPending] = useActionState(createCompanyWithHr, initialRoutineState);
  // On success the message is unique per company (name + URL); using it as the
  // fields' key remounts them cleared, without a setState-in-effect reset.
  const fieldsKey = state.status === "success" ? state.message : "new-company-form";

  return (
    <form action={formAction} className="space-y-4 border border-rule-hairline p-5">
      <div>
        <h2 className="text-sm font-semibold">New company</h2>
        <p className="mt-1 text-xs text-muted">
          Creates a live, branded portal and invites the first HR admin — no DNS or setup needed.
        </p>
      </div>

      <WizardFields key={fieldsKey} />

      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && <p className="text-sm font-medium text-foreground">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create company & invite HR"}
      </button>
    </form>
  );
}
