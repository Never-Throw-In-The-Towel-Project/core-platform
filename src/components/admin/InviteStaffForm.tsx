"use client";

import { useActionState } from "react";
import { inviteStaffMember } from "@/lib/actions/invite";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { Company } from "@/types/database";

const ROLE_LABEL: Record<string, string> = {
  employee: "Employee",
  hr_admin: "HR Admin",
  ntitt_admin: "NTITT Admin",
};

export function InviteStaffForm({ companies }: { companies: Pick<Company, "id" | "name">[] }) {
  const [state, formAction, isPending] = useActionState(inviteStaffMember, initialRoutineState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-black/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Invite someone</h2>
        <p className="mt-1 text-xs opacity-60">
          Sends a sign-in link. Their account is created as soon as you send it -- no self-service
          signup exists on this platform.
        </p>
      </div>
      <label className="block text-sm">
        Name
        <input
          name="displayName"
          type="text"
          required
          maxLength={80}
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Company
        <select
          name="companyId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        >
          <option value="" disabled className="bg-black">
            Choose a company
          </option>
          {companies.map((company) => (
            <option key={company.id} value={company.id} className="bg-black">
              {company.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Role
        <select
          name="role"
          required
          defaultValue="employee"
          className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2"
        >
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value} className="bg-black">
              {label}
            </option>
          ))}
        </select>
      </label>
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
      {state.status === "success" && <p className="text-sm opacity-60">Invite sent.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
