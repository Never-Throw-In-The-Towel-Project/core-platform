"use client";

import { useState, useTransition } from "react";
import { setStandFundamental, saveStandReflections } from "@/lib/actions/stand";
import {
  STAND_FUNDAMENTALS,
  STAND_REFLECTIONS,
  type StandState,
  type StandFundamentalKey,
  type StandReflectionKey,
} from "@/lib/routines/standConfig";

/**
 * The STAND daily fundamentals widget on the Today board. Four one-tap
 * discipline toggles (persisted immediately, optimistic with rollback on
 * failure) plus a collapsible set of the five STAND reflective prompts. This is
 * private, own-rows data -- nothing here is ever shared or reported. The server
 * derives the day from the member's timezone; the client only sends which field
 * and value.
 */
export function StandFundamentals({ initial }: { initial: StandState }) {
  const [ticks, setTicks] = useState<Record<StandFundamentalKey, boolean>>({
    hydration: initial.hydration,
    steps: initial.steps,
    alcohol_free: initial.alcohol_free,
    healthy_food: initial.healthy_food,
  });
  const [reflections, setReflections] = useState<Record<StandReflectionKey, string>>({
    strength_of_connection: initial.strength_of_connection,
    try_new_things: initial.try_new_things,
    active_lifestyle: initial.active_lifestyle,
    notice_the_more: initial.notice_the_more,
    do_good_for_others: initial.do_good_for_others,
  });
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();

  function toggle(key: StandFundamentalKey) {
    const next = !ticks[key];
    setTicks((t) => ({ ...t, [key]: next })); // optimistic
    startToggle(async () => {
      const res = await setStandFundamental(key, next);
      if (!res.ok) setTicks((t) => ({ ...t, [key]: !next })); // rollback on failure
    });
  }

  function save() {
    setSaveState("idle");
    startSave(async () => {
      const res = await saveStandReflections(reflections);
      setSaveState(res.ok ? "saved" : "error");
    });
  }

  const doneCount = Object.values(ticks).filter(Boolean).length;

  return (
    <section className="border border-rule-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
          Today&apos;s fundamentals
        </h2>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          {doneCount}/4
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STAND_FUNDAMENTALS.map((f) => {
          const on = ticks[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggle(f.key)}
              aria-pressed={on}
              className={
                "flex min-h-[40px] items-center gap-1.5 border px-3 py-2 text-sm font-semibold transition-colors " +
                (on
                  ? "border-brand-accent bg-brand-accent text-brand-accent-foreground"
                  : "border-rule-border text-foreground hover:border-foreground")
              }
            >
              <span aria-hidden className="text-xs">
                {on ? "✓" : "○"}
              </span>
              {f.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted">Private to you. Never shared or reported.</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep"
      >
        {open ? "Hide today’s STAND reflections ▴" : "Add today’s STAND reflections ▾"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {STAND_REFLECTIONS.map((r) => (
            <label key={r.key} className="block text-sm">
              <span className="font-medium">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center border border-rule-border text-[10px] font-extrabold">
                  {r.letter}
                </span>
                {r.label}
              </span>
              <textarea
                name={r.key}
                rows={2}
                value={reflections[r.key]}
                onChange={(e) => {
                  setReflections((s) => ({ ...s, [r.key]: e.target.value }));
                  setSaveState("idle");
                }}
                className="mt-1 w-full border border-rule-border bg-transparent px-3 py-2"
              />
            </label>
          ))}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={savePending}
              className="bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
            >
              {savePending ? "Saving…" : "Save reflections"}
            </button>
            {saveState === "saved" && <span className="text-sm text-muted">Saved.</span>}
            {saveState === "error" && (
              <span className="text-sm text-brand-accent-deep">Couldn’t save — try again.</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
