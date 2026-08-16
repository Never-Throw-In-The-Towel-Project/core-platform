"use client";

import { useState, useTransition } from "react";
import {
  proposeWeeklyScheduleAction,
  applyWeeklyScheduleAction,
  type WeeklySchedulePlan,
} from "@/lib/actions/aiSchedule";

const DAY_META: { day: number; name: string; theme: string }[] = [
  { day: 0, name: "Any day", theme: "Evergreen" },
  { day: 1, name: "Mon", theme: "Momentum" },
  { day: 2, name: "Tue", theme: "Talking" },
  { day: 3, name: "Wed", theme: "Workout" },
  { day: 4, name: "Thu", theme: "Thoughts" },
  { day: 5, name: "Fri", theme: "Feel Good" },
  { day: 6, name: "Sat", theme: "Open" },
  { day: 7, name: "Sun", theme: "Open" },
];

/**
 * "Suggest a week with AI" for the calendar's Week view: the AI proposes a
 * weekday (0 = Any day, 1–7 = Mon–Sun) for each unassigned piece; the admin
 * reviews the proposed week — laid out in the same day columns they'll get —
 * tweaks any day, ticks which to apply, and commits. Assistive-with-confirm:
 * proposeWeeklyScheduleAction writes nothing; only Apply
 * (applyWeeklyScheduleAction) sets day_of_week.
 */
export function CalendarWeekSuggest({
  itemIds,
  aiConfigured,
}: {
  itemIds: string[];
  aiConfigured: boolean;
}) {
  const [plan, setPlan] = useState<WeeklySchedulePlan | null>(null);
  const [dayByItem, setDayByItem] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [proposePending, startPropose] = useTransition();
  const [applyPending, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!aiConfigured) {
    return <p className="text-xs text-muted">AI scheduling isn’t configured in this environment.</p>;
  }

  function propose() {
    setError(null);
    setNote(null);
    startPropose(async () => {
      const result = await proposeWeeklyScheduleAction({ itemIds });
      if (result.status === "ok") {
        setPlan(result.plan);
        setExcluded(new Set());
        setDayByItem(Object.fromEntries(result.plan.proposals.map((p) => [p.itemId, p.day])));
      } else {
        setError(result.message);
      }
    });
  }

  function toggle(itemId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function setDay(itemId: string, day: number) {
    setDayByItem((prev) => ({ ...prev, [itemId]: day }));
  }

  function apply() {
    if (!plan) return;
    const assignments = plan.proposals
      .filter((p) => !excluded.has(p.itemId))
      .map((p) => ({ itemId: p.itemId, day: dayByItem[p.itemId] ?? p.day }));
    if (assignments.length === 0) {
      setError("Tick at least one item to apply.");
      return;
    }
    setError(null);
    startApply(async () => {
      const result = await applyWeeklyScheduleAction({ assignments });
      if (result.status === "success") {
        setPlan(null);
        setExcluded(new Set());
        setNote(`Scheduled ${assignments.length} item${assignments.length === 1 ? "" : "s"} across the week.`);
      } else {
        setError(result.status === "error" ? result.message : "Couldn’t apply the schedule. Please try again.");
      }
    });
  }

  if (!plan) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={propose}
          disabled={proposePending || itemIds.length === 0}
          className="border border-brand-accent px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground disabled:opacity-40"
        >
          {proposePending ? "Planning…" : "✦ Suggest a week with AI"}
        </button>
        <span className="text-xs text-muted">
          {itemIds.length === 0
            ? "Every piece is already assigned to a day — move some back to Any day to re-plan."
            : `Proposes a weekday for the ${itemIds.length} unassigned item${itemIds.length === 1 ? "" : "s"} — you review and tweak before anything changes.`}
        </span>
        {note && (
          <span className="text-xs font-semibold text-foreground" role="status">
            {note}
          </span>
        )}
        {error && (
          <span className="text-xs text-brand-accent-deep" role="status">
            {error}
          </span>
        )}
      </div>
    );
  }

  const selectedCount = plan.proposals.length - excluded.size;
  const dayOf = (itemId: string, fallback: number) => dayByItem[itemId] ?? fallback;

  return (
    <div className="border border-brand-accent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-hairline bg-foreground/[0.03] px-4 py-2.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          Proposed week · {plan.proposals.length} item{plan.proposals.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applyPending || selectedCount === 0}
            className="bg-brand-accent px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground disabled:opacity-50"
          >
            {applyPending ? "Applying…" : `Apply ${selectedCount} selected`}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlan(null);
              setError(null);
            }}
            disabled={applyPending}
            className="px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      </div>

      {plan.truncated > 0 && (
        <p className="border-b border-rule-hairline px-4 py-2 text-xs text-muted">
          Planning the first {plan.proposals.length} — {plan.truncated} more not shown. Apply these, then run it again.
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto p-3">
        {DAY_META.map((col) => {
          const colItems = plan.proposals.filter((p) => dayOf(p.itemId, p.day) === col.day);
          return (
            <section key={col.day} className="flex w-[13rem] shrink-0 flex-col border border-rule-hairline">
              <header className="border-b border-rule-hairline px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-extrabold tracking-tight">{col.name}</h3>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                    {colItems.length}
                  </span>
                </div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-brand-accent-deep">
                  {col.theme}
                </p>
              </header>
              {colItems.length === 0 ? (
                <p className="px-2.5 py-3 text-[11px] text-muted">—</p>
              ) : (
                <ul className="flex flex-col gap-2 p-2">
                  {colItems.map((p) => {
                    const included = !excluded.has(p.itemId);
                    return (
                      <li key={p.itemId} className={`border border-rule-hairline p-1.5 ${included ? "" : "opacity-40"}`}>
                        <label className="flex items-start gap-1.5">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggle(p.itemId)}
                            aria-label={`Include ${p.title}`}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-snug">
                            {p.title}
                          </span>
                        </label>
                        <select
                          value={dayOf(p.itemId, p.day)}
                          onChange={(e) => setDay(p.itemId, Number(e.target.value))}
                          aria-label={`Day for ${p.title}`}
                          className="mt-1.5 w-full border border-rule-border bg-transparent px-1 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
                        >
                          {DAY_META.map((d) => (
                            <option key={d.day} value={d.day}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {error && (
        <p className="border-t border-rule-hairline px-4 py-2 text-xs text-brand-accent-deep" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
