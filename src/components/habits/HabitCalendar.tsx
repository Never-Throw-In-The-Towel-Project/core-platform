"use client";

import { useMemo, useState, useTransition } from "react";
import { buildMonthGrid, monthTitle, shiftMonth } from "@/lib/content/calendarMonth";
import { markHabitDayAction } from "@/lib/actions/habits";
import type { HabitCheckInOutcome } from "@/types/database";

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function utcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Monday-first ISO for the week containing `iso`. */
function mondayOf(iso: string): string {
  const d = new Date(utcMs(iso));
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  return isoOf(utcMs(iso) - dow * DAY_MS);
}
function longDate(iso: string): string {
  return new Date(utcMs(iso)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
/** A compact week range like "17–23 Aug" or "31 Aug – 6 Sep" (no year, so it
 *  stays narrow enough for a phone). */
function compactRange(startIso: string, endIso: string): string {
  const s = new Date(utcMs(startIso));
  const e = new Date(utcMs(endIso));
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  return sameMonth
    ? `${s.getUTCDate()}–${e.getUTCDate()} ${mon(e)}`
    : `${s.getUTCDate()} ${mon(s)} – ${e.getUTCDate()} ${mon(e)}`;
}

type Mark = { check_in_date: string; outcome: HabitCheckInOutcome };
type View = "week" | "month";

/**
 * The heart of the Clean Streak: a calendar with a big green tick on every clean
 * day. Week and month views, tap a day to cycle clean -> slip -> clear (a single
 * gesture that covers honesty about a slip without ever erasing the clean-day
 * count), plus a prominent "Mark today clean". Only days inside the challenge
 * window (started_on .. today) are tappable; the future is never markable.
 *
 * The server actions revalidate /clean-streak, so after each tap the page
 * re-renders with fresh marks -- no local optimistic state to drift out of sync;
 * `isPending` just dims the grid while the write lands (same model as StepsCard).
 */
export function HabitCalendar({
  challengeId,
  startedOn,
  todayIso,
  marks,
}: {
  challengeId: string;
  startedOn: string;
  todayIso: string;
  marks: Mark[];
}) {
  const [view, setView] = useState<View>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const todayMonth = useMemo(() => {
    const d = new Date(utcMs(todayIso));
    return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
  }, [todayIso]);
  const [month, setMonth] = useState(todayMonth);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, HabitCheckInOutcome>();
    for (const mk of marks) m.set(mk.check_in_date, mk.outcome);
    return m;
  }, [marks]);

  const todayOutcome = byDate.get(todayIso);

  function markable(iso: string): boolean {
    return iso >= startedOn && iso <= todayIso; // yyyy-mm-dd compares chronologically
  }

  function submit(dateIso: string, outcome: "success" | "slip" | "clear") {
    setError(null);
    const fd = new FormData();
    fd.set("challengeId", challengeId);
    fd.set("date", dateIso);
    fd.set("outcome", outcome);
    startTransition(async () => {
      const res = await markHabitDayAction({ status: "idle" }, fd);
      if (res.status === "error") setError(res.message);
    });
  }

  /** One tap cycles the day: unmarked -> clean -> slip -> unmarked. */
  function cycle(dateIso: string) {
    const current = byDate.get(dateIso);
    const next = current === undefined ? "success" : current === "success" ? "slip" : "clear";
    submit(dateIso, next);
  }

  const weekDates = useMemo(() => {
    const monday = utcMs(mondayOf(todayIso)) + weekOffset * 7 * DAY_MS;
    return Array.from({ length: 7 }, (_, i) => isoOf(monday + i * DAY_MS));
  }, [todayIso, weekOffset]);

  const monthWeeks = useMemo(
    () => buildMonthGrid(month.year, month.monthIndex, todayIso),
    [month, todayIso]
  );
  const weekRangeLabel = compactRange(weekDates[0], weekDates[6]);

  return (
    <section aria-label="Clean streak calendar">
      {/* Mark today */}
      <div className="flex flex-wrap items-center gap-3">
        {todayOutcome === "success" ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 bg-success px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground">
              <Tick className="h-4 w-4" /> Today&rsquo;s in the bag
            </span>
            <button
              type="button"
              onClick={() => submit(todayIso, "clear")}
              disabled={pending}
              className="text-xs font-extrabold uppercase tracking-wide text-muted underline disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => submit(todayIso, "success")}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-success px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground disabled:opacity-50"
            >
              <Tick className="h-4 w-4" /> Mark today clean
            </button>
            <button
              type="button"
              onClick={() => submit(todayIso, "slip")}
              disabled={pending}
              className="text-xs font-extrabold uppercase tracking-wide text-muted underline disabled:opacity-50"
            >
              Had a slip today
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-brand-accent-deep">{error}</p>}

      {/* View toggle + range nav */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/* A two-state view switch -- plain toggle buttons with aria-pressed, not
            an ARIA tablist (there's no tabpanel/arrow-key contract to fulfil). */}
        <div className="flex border-2 border-foreground" role="group" aria-label="Calendar view">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={
                "px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide " +
                (view === v ? "bg-foreground text-background" : "text-foreground hover:bg-foreground/[0.05]")
              }
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <NavButton
            label="Previous"
            onClick={() =>
              view === "week"
                ? setWeekOffset((o) => o - 1)
                : setMonth((m) => shiftMonth(m.year, m.monthIndex, -1))
            }
          >
            ←
          </NavButton>
          <span className="min-w-[7rem] whitespace-nowrap text-center text-sm font-extrabold tracking-tight">
            {view === "week" ? weekRangeLabel : monthTitle(month.year, month.monthIndex)}
          </span>
          <NavButton
            label="Next"
            onClick={() =>
              view === "week"
                ? setWeekOffset((o) => o + 1)
                : setMonth((m) => shiftMonth(m.year, m.monthIndex, 1))
            }
          >
            →
          </NavButton>
        </div>
      </div>

      <div className={"mt-4 " + (pending ? "opacity-60 transition-opacity" : "")} aria-busy={pending}>
        {view === "week" ? (
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((iso) => (
              <DayCell
                key={iso}
                iso={iso}
                outcome={byDate.get(iso)}
                isToday={iso === todayIso}
                markable={markable(iso)}
                inMonth
                size="lg"
                onCycle={cycle}
              />
            ))}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="pb-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-muted">
                  {d}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {monthWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5">
                  {week.map((c) => (
                    <DayCell
                      key={c.iso}
                      iso={c.iso}
                      outcome={byDate.get(c.iso)}
                      isToday={c.isToday}
                      markable={c.inMonth && markable(c.iso)}
                      inMonth={c.inMonth}
                      size="sm"
                      onCycle={cycle}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Legend />
    </section>
  );
}

function DayCell({
  iso,
  outcome,
  isToday,
  markable,
  inMonth,
  size,
  onCycle,
}: {
  iso: string;
  outcome: HabitCheckInOutcome | undefined;
  isToday: boolean;
  markable: boolean;
  inMonth: boolean;
  size: "sm" | "lg";
  onCycle: (iso: string) => void;
}) {
  const day = Number(iso.slice(8, 10));
  const weekdayShort = WEEKDAY_LABELS[(new Date(utcMs(iso)).getUTCDay() + 6) % 7];
  const box =
    "relative flex aspect-square flex-col items-center justify-center border-2 " +
    (isToday ? "border-foreground" : "border-rule-hairline");

  const stateLabel = outcome === "success" ? "clean" : outcome === "slip" ? "a slip" : "not marked";
  const mark =
    outcome === "success" ? (
      <Tick className={size === "lg" ? "h-7 w-7 text-success" : "h-5 w-5 text-success"} />
    ) : outcome === "slip" ? (
      <span className={"bg-muted/50 " + (size === "lg" ? "h-1.5 w-5" : "h-1 w-3.5")} aria-hidden />
    ) : (
      <span aria-hidden />
    );

  // Week (lg): a clean stack -- weekday on top, the mark in the middle, the date
  // underneath -- so nothing overlaps in a narrow cell. Month (sm): the shared
  // header names the weekday, so the cell just carries a corner date + the mark.
  const content =
    size === "lg" ? (
      <div className="flex h-full w-full flex-col items-center justify-between py-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted" aria-hidden>
          {weekdayShort}
        </span>
        {mark}
        <span className="text-[11px] font-bold text-muted" aria-hidden>
          {day}
        </span>
      </div>
    ) : (
      <>
        <span
          className={"absolute right-1 top-1 text-[10px] font-bold " + (inMonth ? "text-muted" : "text-muted/40")}
          aria-hidden
        >
          {day}
        </span>
        {mark}
      </>
    );

  if (!markable) {
    // Non-actionable day (future, or before the challenge started, or an
    // adjacent-month pad). role="img" so the aria-label is a valid accessible
    // name on this otherwise-generic element; dimmed so it reads as inactive in
    // both the week strip and the month grid.
    return (
      <div
        role="img"
        className={box + (outcome === "success" ? " bg-success/10" : "") + " opacity-50"}
        aria-label={`${longDate(iso)}: ${stateLabel}`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCycle(iso)}
      aria-label={`${longDate(iso)}: ${stateLabel}. Tap to change.`}
      className={
        box +
        " transition-colors hover:bg-success/[0.08] " +
        (outcome === "success" ? "bg-success/10" : "")
      }
    >
      {content}
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Tick className="h-4 w-4 text-success" /> Clean day
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-4 bg-muted/50" aria-hidden /> Slip (never erases a clean day)
      </span>
      <span>Tap a day to mark it. You can only mark today and the days behind you.</span>
    </div>
  );
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center border-2 border-foreground text-sm font-extrabold hover:bg-foreground/[0.05]"
    >
      {children}
    </button>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="square" />
    </svg>
  );
}
