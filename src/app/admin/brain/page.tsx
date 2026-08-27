import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { listTopicsWithCounts } from "@/lib/content/topicQueries";
import { listContentFolders, resolveAssetUrls } from "@/lib/content/brain";
import { isAiConfigured } from "@/lib/ai/client";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import { ContentImportForm } from "@/components/admin/ContentImportForm";
import { BrainVimeoImport } from "@/components/admin/BrainVimeoImport";
import { BrainVimeoSync } from "@/components/admin/BrainVimeoSync";
import { BrainVimeoBackfill } from "@/components/admin/BrainVimeoBackfill";
import { BrainFolderCreate } from "@/components/admin/BrainFolderCreate";
import { BrainFolderSettings } from "@/components/admin/BrainFolderSettings";
import { BrainAutoOrganize } from "@/components/admin/BrainAutoOrganize";
import { BrainTopicTag } from "@/components/admin/BrainTopicTag";
import { BrainTopics } from "@/components/admin/BrainTopics";
import { BrainLibrary } from "@/components/admin/brain/BrainLibrary";
import type { ContentFolder, ContentItem, ContentTopicWithCount } from "@/types/database";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * The Brain — the Super Admin (Anthony's team) knowledge base over the
 * content_items spine (docs/CONTENT_PLATFORM_STRATEGY.md; folders migration
 * 20260815000000). A management console: an "Add & import" toolbox (compose,
 * CSV, Vimeo sync/import/backfill, AI auto-organise) collapsed out of the way,
 * a folder sidebar, and the library itself — searchable, filterable, sortable,
 * with multi-select bulk actions (BrainLibrary). ntitt_admin only (guarded on
 * the admin layout; re-asserted here per the codebase pattern).
 */
export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await requireNtittAdmin();
  const { folder: folderParam } = await searchParams;

  // createClient() throws synchronously on a missing/malformed URL/key — degrade
  // to empty lists (a transient-failure reload), never silent data loss. Same
  // guard the Content Studio page uses.
  let companies: { id: string; name: string }[] = [];
  let items: ContentItem[] = [];
  let folders: ContentFolder[] = [];
  let topics: ContentTopicWithCount[] = [];
  let assetUrls: Record<string, string> = {};
  try {
    const supabase = await createClient();
    const [companiesResult, itemsResult, foldersResult, topicsResult] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      listAllContentForAdmin(supabase),
      listContentFolders(supabase),
      listTopicsWithCounts(supabase),
    ]);
    companies = (companiesResult.data as { id: string; name: string }[] | null) ?? [];
    items = itemsResult;
    folders = foldersResult;
    topics = topicsResult;
    assetUrls = resolveAssetUrls(supabase, items);
  } catch {
    companies = [];
    items = [];
    folders = [];
    topics = [];
    assetUrls = {};
  }

  const unfiledCount = items.filter((i) => !i.folder_id).length;
  const countFor = (id: string) => items.filter((i) => i.folder_id === id).length;

  // Which view: "All items" (no param), "Unfiled", or a specific folder. An
  // unknown id (e.g. a just-deleted folder still in the URL) falls back to All.
  const activeFolder =
    folderParam && folderParam !== "unfiled" ? folders.find((f) => f.id === folderParam) ?? null : null;
  const view: "all" | "unfiled" | "folder" =
    folderParam === "unfiled" ? "unfiled" : activeFolder ? "folder" : "all";

  const visible =
    view === "all"
      ? items
      : view === "unfiled"
        ? items.filter((i) => !i.folder_id)
        : items.filter((i) => i.folder_id === activeFolder!.id);

  const heading = view === "unfiled" ? "Unfiled" : activeFolder ? activeFolder.name : "All items";
  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));
  const aiConfigured = isAiConfigured();
  // Videos (anywhere) still missing a still/duration — the "sync from Vimeo"
  // backfill target. A public video has no hash legitimately, so hash isn't the
  // signal; a missing thumbnail or duration is.
  const videosNeedingSync = items.filter(
    (i) => i.type === "video" && (i.thumbnail_url == null || i.duration_seconds == null)
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminPageHeader
        title="Brain"
        description="The knowledge base the AI serves from. Upload or link content of any kind — videos, PDFs, images, external links — file it into folders, tag it, and publish. Search, filter and select many at once to organise fast."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        {/* ---- Folder sidebar ---- */}
        <aside className="space-y-4">
          <nav aria-label="Folders" className="space-y-1">
            <FolderLink href="/admin/brain" label="All items" count={items.length} active={!folderParam} />
            <FolderLink
              href="/admin/brain?folder=unfiled"
              label="Unfiled"
              count={unfiledCount}
              active={folderParam === "unfiled"}
            />
            <div className="pt-2">
              <p className="px-1 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Folders</p>
              {folders.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">No folders yet.</p>
              ) : (
                folders.map((f) => (
                  <FolderLink
                    key={f.id}
                    href={`/admin/brain?folder=${f.id}`}
                    label={f.name}
                    count={countFor(f.id)}
                    active={folderParam === f.id}
                  />
                ))
              )}
            </div>
          </nav>
          <BrainFolderCreate />
        </aside>

        {/* ---- Main column ---- */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-hairline pb-3">
            <h2 className="text-sm font-extrabold tracking-tight">
              {heading} <span className="text-muted">· {visible.length}</span>
            </h2>
            {activeFolder && <BrainFolderSettings folder={activeFolder} itemCount={visible.length} />}
          </div>
          {activeFolder?.description && <p className="mt-2 text-sm text-muted">{activeFolder.description}</p>}

          {/* ---- Add & import toolbox (collapsed by default so the tools stop
               dominating the page; every ingestion path lives in here) ---- */}
          <details className="mt-4 border border-rule-border">
            <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
              + Add &amp; import
              <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
                — compose, CSV, Vimeo{aiConfigured ? ", auto-organise" : ""}
              </span>
            </summary>
            <div className="space-y-4 border-t border-rule-hairline p-4">
              {/* Compose a new item straight into the open folder. */}
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  Add to {activeFolder ? `“${activeFolder.name}”` : "the Brain"}
                </p>
                <p className="mb-3 text-xs text-muted">
                  {activeFolder
                    ? `New items are filed into “${activeFolder.name}”.`
                    : "New items start Unfiled — open a folder first to file them there, or move them later."}
                </p>
                <ContentStudioForm companies={companies} folderId={activeFolder?.id} />
              </div>

              {/* Pull the whole Vimeo account (also runs hourly on its own). */}
              <BrainVimeoSync />
              {/* Pick individual Vimeo videos. */}
              <BrainVimeoImport folderId={activeFolder?.id} folderName={activeFolder?.name} />
              {/* Load a whole catalogue / journal from CSV. */}
              <ContentImportForm />
              {/* Backfill stills/durations for videos added before Vimeo was connected. */}
              {videosNeedingSync > 0 && <BrainVimeoBackfill count={videosNeedingSync} />}
              {/* AI: propose folders + tags for everything in this view. */}
              {visible.length > 0 && (
                <BrainAutoOrganize
                  itemIds={visible.map((i) => i.id)}
                  folderNames={folders.map((f) => f.name)}
                  aiConfigured={aiConfigured}
                />
              )}
              {/* AI: tag the whole library into the member Library's topic rooms. */}
              <BrainTopicTag aiConfigured={aiConfigured} />
            </div>
          </details>

          {/* ---- Library topics: manage the member "Browse by topic" rooms ---- */}
          <details className="mt-4 border border-rule-border">
            <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-accent-deep">
              Library topics
              <span className="ml-2 font-semibold normal-case tracking-normal text-muted">
                — add, rename, reorder or retire the rooms members browse by
              </span>
            </summary>
            <BrainTopics topics={topics} />
          </details>

          {/* ---- The library: stats, command bar, selectable grid, bulk bar ---- */}
          <BrainLibrary items={visible} folders={folderOptions} assetUrls={assetUrls} />
        </section>
      </div>
    </main>
  );
}

function FolderLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between gap-2 border-l-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-brand-accent bg-foreground/[0.03] font-semibold text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{count}</span>
    </Link>
  );
}
