"use client";

import { useState } from "react";

// The picker's starting accent when switching from defaults to custom (matches
// the historical NewCompanyWizard default). Primary starts from the real NTITT
// skin colour, passed in, so "custom" begins where "default" left off.
const ACCENT_START = "#ff563c";

/**
 * The brand-colour picker shared by every company-editing form (the ntitt_admin
 * create wizard + edit form, and the HR company settings form).
 *
 * Brand colours are a TRUE tri-state: a company with NULL colours follows the
 * NTITT defaults (getCompanySkin -> DEFAULT_SKIN for the skin; ThemeProvider
 * leaves --brand-accent alone). A plain `<input type="color">` can't represent
 * "unset" -- it always submits a value -- so without this "use the defaults"
 * checkbox, saving a form (e.g. after editing only the welcome copy) would
 * silently stamp the placeholder swatches over the NULLs and change the
 * members' skin. When ticked, the pickers aren't rendered and the server writes
 * NULLs back (it reads the `useDefaultColours` field); the picked colours are
 * only sent when the admin has deliberately chosen custom ones.
 */
export function BrandColourFields({
  initialPrimary,
  initialAccent,
  defaultPrimaryColor,
}: {
  initialPrimary: string | null;
  initialAccent: string | null;
  /** The NTITT default skin colour (DEFAULT_SKIN), the primary picker's starting
   *  point when a company switches from defaults to custom. */
  defaultPrimaryColor: string;
}) {
  const [useDefaultColours, setUseDefaultColours] = useState(initialPrimary == null && initialAccent == null);

  return (
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
              defaultValue={initialPrimary ?? defaultPrimaryColor}
              className="mt-1 block h-9 w-16 border border-rule-border bg-transparent"
            />
          </label>
          <label className="text-sm">
            Accent
            <input
              name="accentColor"
              type="color"
              defaultValue={initialAccent ?? ACCENT_START}
              className="mt-1 block h-9 w-16 border border-rule-border bg-transparent"
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
