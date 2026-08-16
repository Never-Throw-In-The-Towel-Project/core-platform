import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { CalendarDayControl } from "@/components/admin/CalendarDayControl";
import { ScheduleControl } from "@/components/admin/ScheduleControl";
import { buildMonthGrid, monthTitle, shiftMonth, parseMonthParam, monthParam } from "@/lib/content/calendarMonth";
import type { ContentItem, VideoCategory } from "@/types/database";

const TYPE_LABEL: Record<ContentItem["type"], string> = {
  video: "Video",
  document: "Doc",
  image: "Image",
};

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

// Week view columns: `day` 0 is the "Any day" pool (day_of_week null); 1–7 are
// ISO weekdays labelled with the motivation framework's themes.
const WEEK_COLUMNS: { day: number; name: string; theme: string }[] = [
  { day: 0, name: "Any day", theme: "Surfaces every day · unassigned" },
  { day: 1, name: "Monday", theme: "Momentum Monday" },
  { day: 2, name: "Tuesday", theme: "Talking Tuesday" },
  { day: 3, name: "Wednesday", theme: "Workout Wednesday" },
  { day: 4, name: "Thursday", theme: "Thoughts on Thursday" },
  { day: 5, name: "Friday", theme: "Feel Good Friday" },
  { day: 6, name: "Saturday", theme: "Open slot" },
  { day: 7, name: "Sunday", theme: "Open slot" },
];

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Content distribution calendar (docs/CONTENT_PLATFORM_STRATEGY.md). Two views:
 *   • Week  — the recurring Mon–Sun framework over content_items.day_of_week.
 *   • Month — dated scheduling over content_items.scheduled_for; a draft with a
 *     date auto-publishes on that day (publish-scheduled-content cron).
 * ntitt_admin only — guarded on the admin layout and re-asserted here.
 */
export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  await requireNtittAdmin();
  const { view, month } = await searchParams;
  const isMonth = view === "month";

  let items: ContentItem[] = [];
  try {
    const supabase = await createClient();
    items = await listAllContentForAdmin(supabase);
  } catch {
    items = [];
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const sel = parseMonthParam(month) ?? { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Calendar</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Plan how content reaches members. <strong className="font-semibold text-foreground">Week</strong> assigns
        content to the recurring Monday–Sunday motivation framework; <strong className="font-semibold text-foreground">Month</strong>{" "}
        schedules a piece to go live on a specific date.
      </p>

      {/* View toggle */}
      <div className="mt-6 flex gap-1 border-b border-rule-hairline">
        <ViewTab href="/admin/calendar?view=week" label="Week" active={!isMonth} />
        <ViewTab href="/admin/calendar?view=month" label="Month" active={isMonth} />
      </div>

      {isMonth ? (
        <MonthView items={items} year={sel.year} monthIndex={sel.monthIndex} todayIso={todayIso} />
      ) : (
        <WeekBoard items={items} />
      )}
    </main>
  );
}

function ViewTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] transition-colors ${
        active ? "border-brand-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

// ---- Week view -------------------------------------------------------------

function WeekBoard({ items }: { items: ContentItem[] }) {
  const itemsForDay = (day: number) =>
    day === 0 ? items.filter((i) => i.day_of_week == null) : items.filter((i) => i.day_of_week === day);
  const assignedCount = items.filter((i) => i.day_of_week != null).length;

  if (items.length === 0) {
    return <EmptyContent />;
  }

  return (
    <>
      <p className="mt-4 text-sm text-muted">
        {assignedCount} of {items.length} item{items.length === 1 ? "" : "s"} assigned to a day. Choose a weekday on a
        card and it joins that day’s bank — members see it on that weekday through the rotation.
      </p>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {WEEK_COLUMNS.map((col) => {
          const colItems = itemsForDay(col.day);
          return (
            <section key={col.day} className="flex w-[14rem] shrink-0 flex-col border border-rule-border">
              <header className="border-b border-rule-hairline px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-extrabold tracking-tight">{col.name}</h2>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                    {colItems.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-accent-deep">
                  {col.theme}
                </p>
              </header>
              {colItems.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted">Nothing here yet.</p>
              ) : (
                <ul className="flex flex-col gap-2 p-2">
                  {colItems.map((item) => (
                    <li key={item.id} className="border border-rule-hairline p-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
                          {TYPE_LABEL[item.type]} · {CATEGORY_LABEL[item.category]}
                        </span>
                        <PublishBadge published={item.is_published} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug">{item.title}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <CalendarDayControl itemId={item.id} day={item.day_of_week} />
                        <EditLink id={item.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

// ---- Month view ------------------------------------------------------------

function MonthView({
  items,
  year,
  monthIndex,
  todayIso,
}: {
  items: ContentItem[];
  year: number;
  monthIndex: number;
  todayIso: string;
}) {
  const weeks = buildMonthGrid(year, monthIndex, todayIso);

  const byDate = new Map<string, ContentItem[]>();
  for (const item of items) {
    if (!item.scheduled_for) continue;
    const list = byDate.get(item.scheduled_for) ?? [];
    list.push(item);
    byDate.set(item.scheduled_for, list);
  }
  // Drafts with no date — the pool to schedule from.
  const unscheduled = items.filter((i) => !i.is_published && !i.scheduled_for);

  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, 1);

  if (items.length === 0) {
    return <EmptyContent />;
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavLink href={`/admin/calendar?view=month&month=${monthParam(prev.year, prev.monthIndex)}`} label="‹ Prev" />
          <h2 className="text-sm font-extrabold tracking-tight">{monthTitle(year, monthIndex)}</h2>
          <NavLink href={`/admin/calendar?view=month&month=${monthParam(next.year, next.monthIndex)}`} label="Next ›" />
          <NavLink href="/admin/calendar?view=month" label="Today" />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border border-brand-accent bg-brand-accent" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border border-rule-border" /> Live
          </span>
        </div>
      </div>

      {/* Weekday header row */}
      <div className="mt-4 grid grid-cols-7 border-l border-t border-rule-hairline">
        {WEEKDAY_HEADERS.map((d) => (
          <div
            key={d}
            className="border-b border-r border-rule-hairline px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted"
          >
            {d}
          </div>
        ))}
        {weeks.flat().map((cell) => {
          const cellItems = byDate.get(cell.iso) ?? [];
          return (
            <div
              key={cell.iso}
              className={`min-h-[6.5rem] border-b border-r border-rule-hairline p-1.5 ${
                cell.inMonth ? "" : "bg-foreground/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold ${
                    cell.isToday
                      ? "flex h-5 w-5 items-center justify-center bg-brand-accent text-brand-accent-foreground"
                      : cell.inMonth
                        ? "text-foreground"
                        : "text-muted"
                  }`}
                >
                  {cell.day}
                </span>
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {cellItems.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center gap-1 px-1 py-0.5 text-[10px] leading-tight ${
                      item.is_published
                        ? "border border-rule-border text-foreground"
                        : "bg-brand-accent text-brand-accent-foreground"
                    }`}
                  >
                    <Link href={`/admin/content/${item.id}/edit`} className="min-w-0 flex-1 truncate hover:underline">
                      {item.title}
                    </Link>
                    <ScheduleControl itemId={item.id} scheduledFor={item.scheduled_for} mode="clear" />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Unscheduled drafts */}
      <section className="mt-8">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          Unscheduled drafts · {unscheduled.length}
        </h3>
        {unscheduled.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No unscheduled drafts. New drafts appear here — pick a date to schedule them live.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
            {unscheduled.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {TYPE_LABEL[item.type]} · {CATEGORY_LABEL[item.category]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ScheduleControl itemId={item.id} scheduledFor={item.scheduled_for} />
                  <EditLink id={item.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---- Shared bits -----------------------------------------------------------

function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={
        "shrink-0 border px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] " +
        (published
          ? "border-rule-border text-muted"
          : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
      }
    >
      {published ? "Live" : "Draft"}
    </span>
  );
}

function EditLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/content/${id}/edit`}
      className="shrink-0 border border-rule-border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground"
    >
      Edit
    </Link>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border border-rule-border px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function EmptyContent() {
  return (
    <p className="mt-8 text-sm text-muted">
      No content yet — add pieces in the{" "}
      <Link href="/admin/brain" className="font-semibold text-brand-accent-deep hover:underline">
        Brain
      </Link>{" "}
      or{" "}
      <Link href="/admin/content" className="font-semibold text-brand-accent-deep hover:underline">
        Content Studio
      </Link>
      , then plan them here.
    </p>
  );
}
