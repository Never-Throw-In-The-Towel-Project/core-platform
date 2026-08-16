import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { computeCoverageGaps } from "@/lib/content/coverage";
import { DAY_LABEL } from "@/lib/content/rotation";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import { ContentImportForm } from "@/components/admin/ContentImportForm";
import { ContentItemActions } from "@/components/admin/ContentItemActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { ContentItem, VideoCategory } from "@/types/database";

const TYPE_LABEL: Record<ContentItem["type"], string> = {
  video: "Video",
  document: "Document",
  image: "Image",
};

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

// ISO weekday → single-letter column head for the Coverage strip (Mon–Sun).
const WEEK_LETTERS: [number, string][] = [
  [1, "M"],
  [2, "T"],
  [3, "W"],
  [4, "T"],
  [5, "F"],
  [6, "S"],
  [7, "S"],
];

/**
 * The Super Admin Content Studio (docs/CONTENT_PLATFORM_STRATEGY.md "Pillar 6"),
 * in the Admin Centre design: a scoped header, the "New piece" composer on the
 * left, and a Coverage strip + CSV import rail on the right, with the content
 * list below. Gated by requireNtittAdmin() (never hr_admin), like moderation;
 * reads/writes run under the admin's own RLS-scoped session.
 */
export default async function ContentStudioPage() {
  await requireNtittAdmin();

  // createClient() throws synchronously on a missing/malformed URL/key -- degrade
  // to empty lists (the "nothing yet" state), a transient-failure reload.
  let companies: { id: string; name: string }[] = [];
  let items: ContentItem[] = [];
  try {
    const supabase = await createClient();
    const [companiesResult, itemsResult] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      listAllContentForAdmin(supabase),
    ]);
    companies = (companiesResult.data as { id: string; name: string }[] | null) ?? [];
    items = itemsResult;
  } catch {
    companies = [];
    items = [];
  }

  const coverage = computeCoverageGaps(items);
  const emptyDays = new Set(coverage.emptyDays);
  const hasGaps = coverage.emptyDays.length > 0 || coverage.emptyThemes.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminPageHeader
        title="Content Studio"
        description="Add content, tag it by day and theme, target it to channels, and publish."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* New piece */}
        <div>
          <div className="flex items-center justify-between gap-3 border border-b-0 border-rule-border border-t-2 border-t-foreground px-5 py-3">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em]">New piece</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Saved as a draft unless published
            </span>
          </div>
          <div className="border border-t-0 border-rule-border p-5">
            <ContentStudioForm companies={companies} bare />
          </div>
        </div>

        {/* Right rail: coverage + bulk import */}
        <div className="space-y-6">
          <section className="border border-t-2 border-rule-border border-t-foreground p-5">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Coverage</h2>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {WEEK_LETTERS.map(([day, letter], i) => {
                const filled = coverage.totalPublished > 0 && !emptyDays.has(day);
                return (
                  <div key={`${day}-${i}`} className="text-center">
                    <div
                      className={`aspect-square border ${
                        filled ? "border-brand-accent bg-brand-accent" : "border-rule-hairline bg-inactive"
                      }`}
                      title={`${DAY_LABEL[day]}: ${filled ? "covered" : "no day-tagged content"}`}
                    />
                    <span className="mt-1 block text-[10px] font-bold text-muted">{letter}</span>
                  </div>
                );
              })}
            </div>

            {coverage.totalPublished === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No published content yet — publish a piece to start filling the week.
              </p>
            ) : !hasGaps ? (
              <p className="mt-3 text-sm text-foreground">Every weekday and theme has content. Nice and even.</p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                {coverage.emptyThemes.length > 0 && (
                  <p className="text-xs text-muted">
                    Thin themes:{" "}
                    <span className="font-semibold text-foreground">
                      {coverage.emptyThemes.map((t) => CATEGORY_LABEL[t]).join(", ")}
                    </span>
                  </p>
                )}
                <p className="text-xs text-muted">
                  A member on an empty weekday sees only day-agnostic picks — filling these evens the week out.
                </p>
              </div>
            )}
          </section>

          <ContentImportForm />
        </div>
      </div>

      {/* Content list */}
      <section className="mt-10">
        <h2 className="flex items-baseline gap-2 border-b-2 border-foreground pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em]">
          Content <span className="text-brand-accent-deep">{items.length}</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet — add your first piece above.</p>
        ) : (
          <ul className="mt-1 divide-y divide-rule-hairline">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold leading-tight tracking-tight">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {TYPE_LABEL[item.type]}
                    {item.day_of_week ? ` · ${DAY_LABEL[item.day_of_week]}` : ""}
                    {item.tags.length > 0 ? ` · ${item.tags.length} tag${item.tags.length === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span
                  className={
                    "shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
                    (item.is_published
                      ? "border-rule-border text-muted"
                      : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
                  }
                >
                  {item.is_published ? "Live" : "Draft"}
                </span>
                <ContentItemActions id={item.id} isPublished={item.is_published} title={item.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
