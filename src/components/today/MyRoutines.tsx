"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setRoutineDone } from "@/lib/actions/userRoutines";
import type { TodayRoutine } from "@/lib/routines/userRoutines";

/**
 * The "My Routines" card on the Today rail: the member's own routines that run
 * today, each a one-tap toggle persisted immediately (optimistic, with rollback
 * on failure) -- the same pattern as the STAND Fundamentals card. The server
 * derives the day from the member's timezone; the client only sends which
 * routine and the new value. Private, own-rows data -- never shared or reported.
 *
 * Always rendered (even with nothing today) so the card is the discoverable way
 * into /routines, the way the Clean Streak card is the only way into
 * /clean-streak.
 */
export function MyRoutines({ routines }: { routines: TodayRoutine[] }) {
  const [items, setItems] = useState<TodayRoutine[]>(routines);
  const [, startToggle] = useTransition();

  function toggle(id: string) {
    const current = items.find((r) => r.id === id);
    if (!current) return;
    const next = !current.done;
    setItems((xs) => xs.map((r) => (r.id === id ? { ...r, done: next } : r))); // optimistic
    startToggle(async () => {
      const res = await setRoutineDone(id, next);
      if (!res.ok) setItems((xs) => xs.map((r) => (r.id === id ? { ...r, done: !next } : r))); // rollback
    });
  }

  if (items.length === 0) {
    return (
      <section className="border border-rule-border p-4">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          My routines
        </h2>
        <p className="mt-2 text-sm text-muted">
          Add your own routines — gym, meditate, read — and tick them off here on the days they run.
        </p>
        <Link
          href="/routines"
          className="mt-3 inline-block text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep"
        >
          Add a routine →
        </Link>
      </section>
    );
  }

  const doneCount = items.filter((r) => r.done).length;

  return (
    <section className="border border-rule-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          My routines
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-rule-hairline border-y border-rule-hairline">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={r.done}
              className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-foreground"
            >
              <span
                aria-hidden
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-extrabold " +
                  (r.done ? "border-success bg-success text-success-foreground" : "border-rule-border")
                }
              >
                {r.done ? "✓" : ""}
              </span>
              <span className={"flex-1 text-sm font-semibold leading-snug" + (r.done ? " text-muted line-through" : "")}>
                {r.label}
              </span>
              {r.time && <span className="shrink-0 text-xs text-muted">{r.time}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted">Private to you.</p>
        <Link href="/routines" className="text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep">
          Manage →
        </Link>
      </div>
    </section>
  );
}
