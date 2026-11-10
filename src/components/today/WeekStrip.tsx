import type { Weekday } from "@/types/database";

type DayKey = Weekday | "saturday" | "sunday";

const DAYS: { key: DayKey; letter: string; weekday: boolean }[] = [
  { key: "monday", letter: "M", weekday: true },
  { key: "tuesday", letter: "T", weekday: true },
  { key: "wednesday", letter: "W", weekday: true },
  { key: "thursday", letter: "T", weekday: true },
  { key: "friday", letter: "F", weekday: true },
  { key: "saturday", letter: "S", weekday: false },
  { key: "sunday", letter: "S", weekday: false },
];

/**
 * The seven-cell week strip: completed weekdays filled, today's completed
 * check-in in the vivid accent, the current day outlined, everything else
 * (future days AND -- deliberately, so nothing shames a missed day -- past
 * days without a check-in) shown as a quiet inactive cell. Sunday carries no
 * themed check-in, so it's always inactive; Saturday is the Weekly Review's
 * day in the planner, so it lights up once this week's review is completed
 * (`weeklyReviewDone`) and can be outlined as today like any weekday.
 *
 * `onDark` swaps the completed/today/inactive palettes for the ones that read
 * on the ink progress band (a light fill instead of ink, `inactive-ink` cells)
 * -- the design's home for this strip; the default palette is for a light
 * surface.
 */
export function WeekStrip({
  completedWeekdays,
  todayKey,
  weeklyReviewDone = false,
  onDark = false,
}: {
  completedWeekdays: Set<Weekday>;
  todayKey: DayKey;
  weeklyReviewDone?: boolean;
  onDark?: boolean;
}) {
  return (
    <div className="flex gap-1" role="list" aria-label="This week">
      {DAYS.map(({ key, letter, weekday }, i) => {
        const isToday = key === todayKey;
        // Saturday's "done" is the Weekly Review being completed this week;
        // every Mon-Fri weekday's is its themed check-in. Sunday is never a
        // completable cell here.
        const done =
          key === "saturday" ? weeklyReviewDone : weekday && completedWeekdays.has(key as Weekday);
        // Which cells can show the "today" outline: the Mon-Fri weekdays and
        // Saturday (the review day). Sunday stays a quiet cell even when today.
        const canHighlightToday = weekday || key === "saturday";

        let cls: string;
        if (done && isToday) {
          cls = "bg-brand-accent-vivid text-white border-transparent";
        } else if (done) {
          cls = onDark
            ? "bg-brand-foreground text-brand-background border-transparent"
            : "bg-brand-background text-brand-foreground border-transparent";
        } else if (isToday && canHighlightToday) {
          cls = onDark
            ? "border-2 border-brand-accent-vivid text-brand-foreground"
            : "border-2 border-brand-accent-vivid text-foreground";
        } else {
          cls = onDark
            ? "bg-inactive-ink text-muted-on-ink border-transparent"
            : "bg-inactive text-muted-on-ink border-transparent";
        }

        return (
          <span
            key={`${key}-${i}`}
            role="listitem"
            aria-label={key}
            className={`flex h-9 flex-1 items-center justify-center border text-[13px] font-extrabold ${cls}`}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}
