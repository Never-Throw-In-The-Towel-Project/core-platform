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
 * The seven-cell week strip: completed weekdays ink-filled, today's completed
 * check-in in the vivid accent, the current day outlined, everything else
 * (future days AND -- deliberately, so nothing shames a missed day -- past
 * days without a check-in) shown as a quiet inactive cell. Weekends carry no
 * themed check-in, so they're always inactive.
 */
export function WeekStrip({
  completedWeekdays,
  todayKey,
}: {
  completedWeekdays: Set<Weekday>;
  todayKey: DayKey;
}) {
  return (
    <div className="flex gap-1" role="list" aria-label="This week">
      {DAYS.map(({ key, letter, weekday }, i) => {
        const isToday = key === todayKey;
        const done = weekday && completedWeekdays.has(key as Weekday);

        let cls: string;
        if (done && isToday) {
          cls = "bg-brand-accent-vivid text-white border-transparent";
        } else if (done) {
          cls = "bg-brand-background text-brand-foreground border-transparent";
        } else if (isToday && weekday) {
          cls = "border-2 border-brand-accent-vivid text-foreground";
        } else {
          cls = "bg-inactive text-muted-on-ink border-transparent";
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
