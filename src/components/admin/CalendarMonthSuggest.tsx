"use client";

import { useState, useTransition } from "react";
import {
  proposeMonthScheduleAction,
  applyMonthScheduleAction,
  type MonthSchedulePlan,
} from "@/lib/actions/aiSchedule";

/**
 * "Suggest a schedule with AI" for the calendar's Month view: the AI proposes a
 * publish date for each unscheduled draft (by matching it to a weekday theme,
 * then a deterministic date layout — see scheduleLayout), and the admin reviews
 * the dated plan, tweaks any date, ticks which to apply, and commits.
 * Assistive-with-confirm: proposeMonthScheduleAction writes nothing; only Apply
 * (applyMonthScheduleAction) sets scheduled_for.
 */
export function CalendarMonthSuggest({
  itemIds,
  aiConfigured,
}: {
  itemIds: string[];
  aiConfigured: boolean;
}) {
  const [plan, setPlan] = useState<MonthSchedulePlan | null>(null);
  const [dateByItem, setDateByItem] = useState<Record<string, string>>({});
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
      const result = await proposeMonthScheduleAction({ itemIds });
      if (result.status === "ok") {
        setPlan(result.plan);
        setExcluded(new Set());
        setDateByItem(Object.fromEntries(result.plan.proposals.map((p) => [p.itemId, p.date])));
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

  function setDate(itemId: string, date: string) {
    setDateByItem((prev) => ({ ...prev, [itemId]: date }));
  }

  function apply() {
    if (!plan) return;
    const included = plan.proposals.filter((p) => !excluded.has(p.itemId));
    const assignments = included.map((p) => ({ itemId: p.itemId, date: dateByItem[p.itemId] ?? p.date }));
    if (assignments.length === 0) {
      setError("Tick at least one item to apply.");
      return;
    }
    if (assignments.some((a) => !/^\d{4}-\d{2}-\d{2}$/.test(a.date))) {
      setError("Give every selected item a date.");
      return;
    }
    setError(null);
    startApply(async () => {
      const result = await applyMonthScheduleAction({ assignments });
      if (result.status === "success") {
        setPlan(null);
        setExcluded(new Set());
        setNote(`Scheduled ${assignments.length} item${assignments.length === 1 ? "" : "s"}.`);
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
          {proposePending ? "Planning…" : "✦ Suggest a schedule with AI"}
        </button>
        <span className="text-xs text-muted">
          {itemIds.length === 0
            ? "No unscheduled drafts to schedule."
            : `Proposes a publish date for the ${itemIds.length} unscheduled draft${itemIds.length === 1 ? "" : "s"} — you review and tweak before anything changes.`}
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
  const ordered = [...plan.proposals].sort((a, b) =>
    (dateByItem[a.itemId] ?? a.date).localeCompare(dateByItem[b.itemId] ?? b.date)
  );

  return (
    <div className="border border-brand-accent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-hairline bg-foreground/[0.03] px-4 py-2.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
          Proposed schedule · {plan.proposals.length} item{plan.proposals.length === 1 ? "" : "s"}
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
          Scheduling the first {plan.proposals.length} — {plan.truncated} more not shown. Apply these, then run it again.
        </p>
      )}

      <ul className="divide-y divide-rule-hairline">
        {ordered.map((p) => {
          const included = !excluded.has(p.itemId);
          return (
            <li key={p.itemId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                checked={included}
                onChange={() => toggle(p.itemId)}
                aria-label={`Include ${p.title}`}
                className="h-4 w-4 shrink-0"
              />
              <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${included ? "" : "opacity-40"}`}>
                {p.title}
              </span>
              <input
                type="date"
                value={dateByItem[p.itemId] ?? p.date}
                onChange={(e) => setDate(p.itemId, e.target.value)}
                aria-label={`Publish date for ${p.title}`}
                className="border border-rule-border bg-transparent px-1.5 py-0.5 text-[11px] text-foreground"
              />
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="border-t border-rule-hairline px-4 py-2 text-xs text-brand-accent-deep" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
