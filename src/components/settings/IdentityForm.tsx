"use client";

import { useActionState } from "react";
import { updateIdentity } from "@/lib/actions/settings";
import { initialRoutineState } from "@/lib/actions/routineState";
import { IDENTITY_PREFERENCES } from "@/lib/identity/preference";
import type { CommunityIdentityPreference } from "@/types/database";

/**
 * The member's identity details, gathered at signup and editable here: their
 * real name (admin-visible), date of birth, and how they appear to other
 * members. The public handle (shown when anonymous) is edited in the Account
 * card above. Mirrors TimezoneForm's styling.
 */
export function IdentityForm({
  currentFullName,
  currentDateOfBirth,
  currentPreference,
}: {
  currentFullName: string | null;
  currentDateOfBirth: string | null;
  currentPreference: CommunityIdentityPreference;
}) {
  const [state, formAction, isPending] = useActionState(updateIdentity, initialRoutineState);
  const inputClass = "w-full border border-rule-border bg-transparent px-3 py-2.5 text-sm";

  return (
    <form action={formAction} className="space-y-3 border border-rule-hairline p-4">
      <div>
        <label htmlFor="fullName" className="text-sm font-medium">
          Full name
        </label>
        <p className="mt-1 text-xs text-muted">
          Your real name. NTITT admins can always see this; other members see it only when your community
          setting below shows your name.
        </p>
      </div>
      <input
        id="fullName"
        name="fullName"
        type="text"
        defaultValue={currentFullName ?? ""}
        maxLength={120}
        required
        autoComplete="name"
        className={inputClass}
      />

      <div>
        <label htmlFor="dateOfBirth" className="text-sm font-medium">
          Date of birth
        </label>
      </div>
      <input
        id="dateOfBirth"
        name="dateOfBirth"
        type="date"
        defaultValue={currentDateOfBirth ?? ""}
        autoComplete="bday"
        className={inputClass}
      />

      <div>
        <label htmlFor="identityPreference" className="text-sm font-medium">
          How you appear in the community
        </label>
        <p className="mt-1 text-xs text-muted">
          What other members see. Admins always see your real name. When set to “anonymously”, you appear as
          your public handle (set in Account above).
        </p>
      </div>
      <select
        id="identityPreference"
        name="identityPreference"
        defaultValue={currentPreference}
        className={inputClass}
      >
        {IDENTITY_PREFERENCES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
      {state.status === "success" && <p className="text-sm font-semibold text-foreground">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-accent px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
