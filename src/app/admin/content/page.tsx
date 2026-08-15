import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { computeCoverageGaps } from "@/lib/content/coverage";
import { DAY_LABEL } from "@/lib/content/rotation";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import { ContentImportForm } from "@/components/admin/ContentImportForm";
import { ContentItemActions } from "@/components/admin/ContentItemActions";
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

/**
 * The Super Admin content Studio (docs/CONTENT_PLATFORM_STRATEGY.md "Pillar
 * 6") -- gated by requireNtittAdmin(), never hr_admin, like the moderation
 * queue. The first step of shifting content ops off Supabase Studio and into
 * the app: add a content item, tag it (theme, day, tags), target it to
 * channels, and publish. Reads/writes run under the admin's own RLS-scoped
 * session -- the "ntitt admins" content policies grant exactly this.
 */
export default async function ContentStudioPage() {
  await requireNtittAdmin();

  // Wrapped in try/catch: createClient() throws synchronously if the URL/key
  // are missing or malformed -- degrade to empty lists (the same "nothing yet"
  // state), a transient-failure reload, not silent data loss.
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">Admin</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Content Studio</h1>
      <p className="mt-1 text-sm text-muted">
        Add content, tag it by day and theme, target it to channels, and publish.
      </p>

      <div className="mt-8">
        <ContentStudioForm companies={companies} />
      </div>

      <div className="mt-4">
        <ContentImportForm />
      </div>

      {(() => {
        // Deterministic gap detection (no AI, no API key needed): where is
        // published coverage thin across the Mon–Sun days and the four themes?
        const coverage = computeCoverageGaps(items);
        const hasGaps = coverage.emptyDays.length > 0 || coverage.emptyThemes.length > 0;
        return (
          <section className="mt-10 border border-rule-border p-5">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Coverage</h2>
            {coverage.totalPublished === 0 ? (
              <p className="mt-2 text-sm text-muted">No published content yet — publish a piece to start filling the week.</p>
            ) : !hasGaps ? (
              <p className="mt-2 text-sm text-foreground">
                Every weekday and every theme has published content. Nice and even.
              </p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {coverage.emptyDays.length > 0 && (
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                      No day-tagged content for
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {coverage.emptyDays.map((day) => (
                        <span key={day} className="border border-rule-border px-2 py-0.5 text-xs font-semibold">
                          {DAY_LABEL[day]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {coverage.emptyThemes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                      No published content in
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {coverage.emptyThemes.map((theme) => (
                        <span key={theme} className="border border-rule-border px-2 py-0.5 text-xs font-semibold">
                          {CATEGORY_LABEL[theme]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted">
                  A member browsing on an empty weekday sees only day-agnostic picks — filling these evens the week out.
                </p>
              </div>
            )}
          </section>
        );
      })()}

      <div className="mt-10">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          Content ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet — add your first piece above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-hairline border-t border-rule-hairline">
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
      </div>
    </main>
  );
}
