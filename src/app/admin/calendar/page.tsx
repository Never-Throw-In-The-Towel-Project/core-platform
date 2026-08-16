import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { CalendarDayControl } from "@/components/admin/CalendarDayControl";
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

// The Mon–Sun distribution grid. `day` 0 is the "Any day" pool (day_of_week
// null — surfaces every day / not yet assigned); 1–7 are ISO weekdays. The
// theme labels tie each weekday to the motivation framework (Mon–Fri named
// rituals; weekends are open slots).
const COLUMNS: { day: number; name: string; theme: string }[] = [
  { day: 0, name: "Any day", theme: "Surfaces every day · unassigned" },
  { day: 1, name: "Monday", theme: "Momentum Monday" },
  { day: 2, name: "Tuesday", theme: "Talking Tuesday" },
  { day: 3, name: "Wednesday", theme: "Workout Wednesday" },
  { day: 4, name: "Thursday", theme: "Thoughts on Thursday" },
  { day: 5, name: "Friday", theme: "Feel Good Friday" },
  { day: 6, name: "Saturday", theme: "Open slot" },
  { day: 7, name: "Sunday", theme: "Open slot" },
];

/**
 * Content distribution calendar — Week view (docs/CONTENT_PLATFORM_STRATEGY.md,
 * the Mon–Sun framework). A board over content_items.day_of_week: each weekday
 * column shows the content bank that surfaces to members on that day (via the
 * live day-of-week carousel rotation), plus an "Any day" pool to assign from.
 * Drafts are shown too (this is a planning surface) with a Live/Draft badge.
 * ntitt_admin only — guarded on the admin layout and re-asserted here.
 */
export default async function ContentCalendarPage() {
  await requireNtittAdmin();

  // createClient() can throw on a missing/malformed URL/key; degrade to an
  // empty board (transient-failure reload) rather than crashing the page.
  let items: ContentItem[] = [];
  try {
    const supabase = await createClient();
    items = await listAllContentForAdmin(supabase);
  } catch {
    items = [];
  }

  const itemsForDay = (day: number) =>
    day === 0 ? items.filter((i) => i.day_of_week == null) : items.filter((i) => i.day_of_week === day);

  const assignedCount = items.filter((i) => i.day_of_week != null).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Calendar</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Plan the Monday–Sunday motivation framework. Assign videos and other content to a day and it joins that day’s
        bank — members see it on that weekday through the rotation. {assignedCount} of {items.length} item
        {items.length === 1 ? "" : "s"} assigned to a day.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No content yet — add pieces in the{" "}
          <Link href="/admin/brain" className="font-semibold text-brand-accent-deep hover:underline">
            Brain
          </Link>{" "}
          or{" "}
          <Link href="/admin/content" className="font-semibold text-brand-accent-deep hover:underline">
            Content Studio
          </Link>
          , then assign them to days here.
        </p>
      ) : (
        <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colItems = itemsForDay(col.day);
            return (
              <section
                key={col.day}
                className={`flex w-[14rem] shrink-0 flex-col border ${
                  col.day === 0 ? "border-rule-border bg-foreground/[0.02]" : "border-rule-border"
                }`}
              >
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
                          <span
                            className={
                              "shrink-0 border px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] " +
                              (item.is_published
                                ? "border-rule-border text-muted"
                                : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
                            }
                          >
                            {item.is_published ? "Live" : "Draft"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug">{item.title}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <CalendarDayControl itemId={item.id} day={item.day_of_week} />
                          <Link
                            href={`/admin/content/${item.id}/edit`}
                            className="shrink-0 border border-rule-border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted hover:text-foreground"
                          >
                            Edit
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
