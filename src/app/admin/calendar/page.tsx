import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { CalendarDayControl } from "@/components/admin/CalendarDayControl";
import { ScheduleControl } from "@/components/admin/ScheduleControl";
import { buildMonthGrid, monthTitle, shiftMonth, parseMonthParam, monthParam } from "@/lib/content/calendarMonth";
import { isAiConfigured } from "@/lib/ai/client";
import { CalendarWeekSuggest } from "@/components/admin/CalendarWeekSuggest";
import { CalendarMonthSuggest } from "@/components/admin/CalendarMonthSuggest";
import { CalendarChannelSelect } from "@/components/admin/CalendarChannelSelect";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import { CalendarDraggable } from "@/components/admin/CalendarDraggable";
import { CalendarDropZone } from "@/components/admin/CalendarDropZone";
import { isVisibleOnChannel } from "@/lib/content/channelVisibility";
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
  searchParams: Promise<{ view?: string; month?: string; channel?: string; add?: string; addDay?: string }>;
}) {
  await requireNtittAdmin();
  const { view, month, channel: channelParam, add, addDay } = await searchParams;
  const isMonth = view === "month";
  const viewName: "week" | "month" = isMonth ? "month" : "week";
  const channel = channelParam || "all";
  // A day clicked to add content on: a yyyy-mm-dd date (Month) or a 0–7 weekday (Week).
  const addDate = add && /^\d{4}-\d{2}-\d{2}$/.test(add) ? add : null;
  const addDayNum = addDay !== undefined && /^[0-7]$/.test(addDay) ? Number(addDay) : null;

  let items: ContentItem[] = [];
  let companies: { id: string; name: string }[] = [];
  const placementsByItem = new Map<string, Set<string>>();
  try {
    const supabase = await createClient();
    const [itemsResult, companiesResult] = await Promise.all([
      listAllContentForAdmin(supabase),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    items = itemsResult;
    companies = (companiesResult.data as { id: string; name: string }[] | null) ?? [];

    // Placements are only needed to filter to a specific channel — skip the read
    // entirely for "All channels" (the default). Page through them because
    // PostgREST caps a single response at 1000 rows; without paging, a large
    // placement set would be silently truncated and targeted items misread as
    // NTITT-wide (visible everywhere).
    if (channel !== "all") {
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("content_channel_placements")
          .select("content_item_id, company_id")
          .range(from, from + 999);
        const rows = (data as { content_item_id: string; company_id: string }[] | null) ?? [];
        for (const row of rows) {
          const set = placementsByItem.get(row.content_item_id) ?? new Set<string>();
          set.add(row.company_id);
          placementsByItem.set(row.content_item_id, set);
        }
        if (rows.length < 1000) break;
      }
    }
  } catch {
    items = [];
    companies = [];
  }

  const visibleItems =
    channel === "all" ? items : items.filter((i) => isVisibleOnChannel(placementsByItem.get(i.id), channel));

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const sel = parseMonthParam(month) ?? { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() };
  const aiConfigured = isAiConfigured();

  const monthForLink = isMonth ? monthParam(sel.year, sel.monthIndex) : undefined;
  const channelOptions = [
    { value: "all", label: "All channels", href: calendarHref(viewName, "all", monthForLink) },
    { value: "global", label: "NTITT-wide only", href: calendarHref(viewName, "global", monthForLink) },
    ...companies.map((c) => ({ value: c.id, label: c.name, href: calendarHref(viewName, c.id, monthForLink) })),
  ];
  const channelLabel = channelOptions.find((o) => o.value === channel)?.label ?? "All channels";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Calendar</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Plan how content reaches members. <strong className="font-semibold text-foreground">Week</strong> assigns
        content to the recurring Monday–Sunday motivation framework; <strong className="font-semibold text-foreground">Month</strong>{" "}
        schedules a piece to go live on a specific date.
      </p>

      {/* View toggle + channel filter */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-rule-hairline">
        <div className="flex gap-1">
          <ViewTab href={calendarHref("week", channel)} label="Week" active={!isMonth} />
          <ViewTab href={calendarHref("month", channel)} label="Month" active={isMonth} />
        </div>
        <div className="pb-2">
          <CalendarChannelSelect value={channel} options={channelOptions} />
        </div>
      </div>

      {channel !== "all" && (
        <p className="mt-3 text-xs text-muted">
          Showing what <strong className="font-semibold text-foreground">{channelLabel}</strong>{" "}
          {channel === "global"
            ? "members see — content targeted to no specific partner."
            : "members see — NTITT-wide content plus anything targeted to them."}{" "}
          Day and schedule changes still apply to the content everywhere it runs.
        </p>
      )}

      {isMonth ? (
        <MonthView
          items={visibleItems}
          year={sel.year}
          monthIndex={sel.monthIndex}
          todayIso={todayIso}
          channel={channel}
          aiConfigured={aiConfigured}
          companies={companies}
          addDate={addDate}
        />
      ) : (
        <WeekBoard
          items={visibleItems}
          aiConfigured={aiConfigured}
          channel={channel}
          companies={companies}
          addDay={addDayNum}
        />
      )}
    </main>
  );
}

/** Build an /admin/calendar URL preserving the view, channel and (month-view) month. */
function calendarHref(view: "week" | "month", channel: string, month?: string): string {
  const sp = new URLSearchParams();
  sp.set("view", view);
  if (channel && channel !== "all") sp.set("channel", channel);
  if (month) sp.set("month", month);
  return `/admin/calendar?${sp.toString()}`;
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

function WeekBoard({
  items,
  aiConfigured,
  channel,
  companies,
  addDay,
}: {
  items: ContentItem[];
  aiConfigured: boolean;
  channel: string;
  companies: { id: string; name: string }[];
  addDay: number | null;
}) {
  const itemsForDay = (day: number) =>
    day === 0 ? items.filter((i) => i.day_of_week == null) : items.filter((i) => i.day_of_week === day);
  const assignedCount = items.filter((i) => i.day_of_week != null).length;
  const addDayHref = (n: number) => `${calendarHref("week", channel)}&addDay=${n}`;

  return (
    <>
      <p className="mt-4 text-sm text-muted">
        {items.length === 0
          ? "Nothing here yet — click a day’s + to add content straight onto that weekday."
          : `${assignedCount} of ${items.length} item${items.length === 1 ? "" : "s"} assigned to a day. Click a day’s + to add new content, or drag a card to another day (or use its day menu) to move it — members see it on that weekday through the rotation.`}
      </p>

      {addDay != null && (
        <AddComposer
          heading={`New content · ${WEEK_COLUMNS.find((c) => c.day === addDay)?.name ?? "the week"}`}
          hint={
            addDay === 0
              ? "Not tied to a weekday — surfaces every day once published."
              : "Joins that weekday’s bank and surfaces to members on that day."
          }
          backHref={calendarHref("week", channel)}
          companies={companies}
          defaultDayOfWeek={addDay}
        />
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <CalendarWeekSuggest
            itemIds={items.filter((i) => i.day_of_week == null).map((i) => i.id)}
            aiConfigured={aiConfigured}
          />
        </div>
      )}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {WEEK_COLUMNS.map((col) => {
          const colItems = itemsForDay(col.day);
          return (
            <section key={col.day} className="flex w-[14rem] shrink-0 flex-col border border-rule-border">
              <header className="border-b border-rule-hairline px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-extrabold tracking-tight">{col.name}</h2>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                      {colItems.length}
                    </span>
                    <AddLink href={addDayHref(col.day)} label={`Add content for ${col.name}`} />
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-accent-deep">
                  {col.theme}
                </p>
              </header>
              <CalendarDropZone
                target={{ type: "day", day: col.day }}
                className="flex-1 p-2"
                activeClassName="bg-brand-accent/10 ring-2 ring-inset ring-brand-accent"
              >
                {colItems.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted">Nothing here — drop a card to assign it.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {colItems.map((item) => (
                      <li key={item.id}>
                        <CalendarDraggable itemId={item.id}>
                          <div className="border border-rule-hairline p-2">
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
                          </div>
                        </CalendarDraggable>
                      </li>
                    ))}
                  </ul>
                )}
              </CalendarDropZone>
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
  channel,
  aiConfigured,
  companies,
  addDate,
}: {
  items: ContentItem[];
  year: number;
  monthIndex: number;
  todayIso: string;
  channel: string;
  aiConfigured: boolean;
  companies: { id: string; name: string }[];
  addDate: string | null;
}) {
  const weeks = buildMonthGrid(year, monthIndex, todayIso);
  const addHref = (iso: string) => `${calendarHref("month", channel, monthParam(year, monthIndex))}&add=${iso}`;

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

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavLink href={calendarHref("month", channel, monthParam(prev.year, prev.monthIndex))} label="‹ Prev" />
          <h2 className="text-sm font-extrabold tracking-tight">{monthTitle(year, monthIndex)}</h2>
          <NavLink href={calendarHref("month", channel, monthParam(next.year, next.monthIndex))} label="Next ›" />
          <NavLink href={calendarHref("month", channel)} label="Today" />
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

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          Nothing scheduled yet — click a day’s + to add content and set it live on that date.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Drag a scheduled item to another day to move it, or into “Unscheduled drafts” below to unschedule.
        </p>
      )}

      {addDate && (
        <AddComposer
          heading={`New content · ${formatIsoDate(addDate)}`}
          hint="Goes live on this date. It sits as a scheduled draft until then."
          backHref={calendarHref("month", channel, monthParam(year, monthIndex))}
          companies={companies}
          scheduledFor={addDate}
        />
      )}

      {unscheduled.length > 0 && (
        <div className="mt-4">
          <CalendarMonthSuggest itemIds={unscheduled.map((i) => i.id)} aiConfigured={aiConfigured} />
        </div>
      )}

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
            <CalendarDropZone
              key={cell.iso}
              target={{ type: "date", date: cell.iso }}
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
                {cell.inMonth && <AddLink href={addHref(cell.iso)} label={`Add content for ${cell.iso}`} />}
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {cellItems.map((item) => (
                  <li key={item.id}>
                    <CalendarDraggable itemId={item.id}>
                      <div
                        className={`flex items-center gap-1 px-1 py-0.5 text-[10px] leading-tight ${
                          item.is_published
                            ? "border border-rule-border text-foreground"
                            : "bg-brand-accent text-brand-accent-foreground"
                        }`}
                      >
                        <Link
                          href={`/admin/content/${item.id}/edit`}
                          draggable={false}
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {item.title}
                        </Link>
                        <ScheduleControl itemId={item.id} scheduledFor={item.scheduled_for} mode="clear" />
                      </div>
                    </CalendarDraggable>
                  </li>
                ))}
              </ul>
            </CalendarDropZone>
          );
        })}
      </div>

      {/* Unscheduled drafts — also a drop target: drop a scheduled item here to unschedule it. */}
      <CalendarDropZone target={{ type: "unschedule" }} className="mt-8" activeClassName="ring-2 ring-inset ring-brand-accent">
        <section>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Unscheduled drafts · {unscheduled.length}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Drag a draft onto a day to schedule it — or drop a scheduled item here to unschedule.
          </p>
          {unscheduled.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No unscheduled drafts right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
              {unscheduled.map((item) => (
                <li key={item.id}>
                  <CalendarDraggable itemId={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
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
                    </div>
                  </CalendarDraggable>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CalendarDropZone>
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

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-20" → "20 Aug 2026" (pure, no locale). */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

/** The small "+" on a day cell / column header that opens the add composer for it. */
function AddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-4 w-4 shrink-0 items-center justify-center border border-rule-border text-[11px] font-bold leading-none text-brand-accent-deep transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground"
    >
      +
    </Link>
  );
}

/**
 * The add-content composer opened by clicking a day. Reuses the Studio form,
 * pre-set to a publish date (Month) or a weekday (Week). A "Cancel" link drops
 * the add param and returns to the plain view.
 */
function AddComposer({
  heading,
  hint,
  backHref,
  companies,
  scheduledFor,
  defaultDayOfWeek,
}: {
  heading: string;
  hint: string;
  backHref: string;
  companies: { id: string; name: string }[];
  scheduledFor?: string;
  defaultDayOfWeek?: number;
}) {
  return (
    <div className="mt-4 border border-brand-accent">
      <div className="flex items-start justify-between gap-3 border-b border-rule-hairline bg-foreground/[0.03] px-4 py-2.5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">{heading}</p>
          <p className="mt-0.5 text-xs text-muted">{hint}</p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
      <div className="p-4">
        <ContentStudioForm companies={companies} scheduledFor={scheduledFor} defaultDayOfWeek={defaultDayOfWeek} />
      </div>
    </div>
  );
}
