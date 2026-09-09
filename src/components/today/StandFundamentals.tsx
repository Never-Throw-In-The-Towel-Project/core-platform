"use client";

import { useState, useTransition } from "react";
import { setStandFundamental } from "@/lib/actions/stand";
import { STAND_FUNDAMENTALS, type StandState, type StandFundamentalKey } from "@/lib/routines/standConfig";

/**
 * The Fundamentals Daily Checklist on the Today rail (under the Clean Streak
 * card). Anthony's journal checklist: five plain yes/no questions, each a
 * one-tap toggle persisted immediately (optimistic, with rollback on failure).
 * The whole row is the tap target. This is private, own-rows data -- nothing
 * here is ever shared or reported. The server derives the day from the member's
 * timezone; the client only sends which field and value.
 */
export function StandFundamentals({ initial }: { initial: StandState }) {
  const [ticks, setTicks] = useState<StandState>(initial);
  const [, startToggle] = useTransition();

  function toggle(key: StandFundamentalKey) {
    const next = !ticks[key];
    setTicks((t) => ({ ...t, [key]: next })); // optimistic
    startToggle(async () => {
      const res = await setStandFundamental(key, next);
      if (!res.ok) setTicks((t) => ({ ...t, [key]: !next })); // rollback on failure
    });
  }

  const doneCount = STAND_FUNDAMENTALS.filter((f) => ticks[f.key]).length;

  return (
    <section className="border border-rule-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          Fundamentals
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {doneCount}/{STAND_FUNDAMENTALS.length}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-rule-hairline border-y border-rule-hairline">
        {STAND_FUNDAMENTALS.map((f) => {
          const on = ticks[f.key];
          return (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => toggle(f.key)}
                aria-pressed={on}
                className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:text-foreground"
              >
                <span
                  aria-hidden
                  className={
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-extrabold " +
                    (on ? "border-success bg-success text-success-foreground" : "border-rule-border")
                  }
                >
                  {on ? "✓" : ""}
                </span>
                <span className="text-sm font-semibold leading-snug">{f.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-muted">Private to you. Never shared or reported.</p>
    </section>
  );
}
