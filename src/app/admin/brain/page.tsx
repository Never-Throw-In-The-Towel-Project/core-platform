import Link from "next/link";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listAllContentForAdmin } from "@/lib/content/queries";
import { listContentFolders, resolveAssetUrls } from "@/lib/content/brain";
import { isAiConfigured } from "@/lib/ai/client";
import { DAY_LABEL } from "@/lib/content/rotation";
import { ContentStudioForm } from "@/components/admin/ContentStudioForm";
import { ContentImportForm } from "@/components/admin/ContentImportForm";
import { BrainVimeoImport } from "@/components/admin/BrainVimeoImport";
import { ContentItemActions } from "@/components/admin/ContentItemActions";
import { BrainMoveControl } from "@/components/admin/BrainMoveControl";
import { BrainFolderCreate } from "@/components/admin/BrainFolderCreate";
import { BrainFolderSettings } from "@/components/admin/BrainFolderSettings";
import { BrainAutoOrganize } from "@/components/admin/BrainAutoOrganize";
import { BrainPublishAll } from "@/components/admin/BrainPublishAll";
import type { ContentFolder, ContentItem, VideoCategory } from "@/types/database";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const TYPE_LABEL: Record<ContentItem["type"], string> = {
  video: "Video",
  document: "Document",
  image: "Image",
  text: "Text",
};

const CATEGORY_LABEL: Record<VideoCategory, string> = {
  mental_fitness: "Mental Fitness",
  physical_fitness: "Physical Fitness",
  nutrition: "Nutrition",
  tools_tips: "Tools & Tips",
};

/**
 * The Brain — the Super Admin (Anthony's team) knowledge base over the
 * content_items spine (docs/CONTENT_PLATFORM_STRATEGY.md; the folders migration
 * 20260815000000). One place to upload/link content of any type (video,
 * document/PDF, image, external URL), file it into folders, and richly tag it,
 * so the AI brain has an organised, tagged substrate to sort/arrange and serve
 * from. ntitt_admin only (guarded on the admin layout; re-asserted here per the
 * codebase pattern). Reuses the content Studio composer (with its assistive
 * AI tag-suggestions), the per-item publish/edit/delete controls, and the
 * content-assets Storage bucket — the Brain is the organising surface on top.
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
  let assetUrls: Record<string, string> = {};
  try {
    const supabase = await createClient();
    const [companiesResult, itemsResult, foldersResult] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      listAllContentForAdmin(supabase),
      listContentFolders(supabase),
    ]);
    companies = (companiesResult.data as { id: string; name: string }[] | null) ?? [];
    items = itemsResult;
    folders = foldersResult;
    assetUrls = resolveAssetUrls(supabase, items);
  } catch {
    companies = [];
    items = [];
    folders = [];
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
    view === "all" ? items : view === "unfiled" ? items.filter((i) => !i.folder_id) : items.filter((i) => i.folder_id === activeFolder!.id);

  const heading = view === "unfiled" ? "Unfiled" : activeFolder ? activeFolder.name : "All items";
  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }));
  const aiConfigured = isAiConfigured();
  // The drafts in the current view, for the one-click "Publish all" control.
  const draftIds = visible.filter((i) => !i.is_published).map((i) => i.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AdminPageHeader
        title="Brain"
        description="The knowledge base the AI serves from. Upload or link content of any kind — videos, PDFs, images, external links — file it into folders, and tag it so the brain can sort and arrange it for the right day, channel and member."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
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

          {/* Add-to-Brain composer (collapsed): reuses the Studio form, filing
              new items straight into the open folder when one is selected. */}
          <details className="mt-4 border border-rule-border">
            <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
              + Add to {activeFolder ? `“${activeFolder.name}”` : "the Brain"}
            </summary>
            <div className="border-t border-rule-hairline p-4">
              <p className="mb-3 text-xs text-muted">
                {activeFolder
                  ? `New items are filed into “${activeFolder.name}”.`
                  : "New items start Unfiled — open a folder first to file them there, or move them later."}
              </p>
              <ContentStudioForm companies={companies} folderId={activeFolder?.id} />
            </div>
          </details>

          {/* Bulk import: the same CSV importer as Content Studio, surfaced here
              too so a whole catalogue (or Anthony's journal) can be loaded
              straight into the Brain. A row's `folder` column files it into that
              folder (created if new); rows without one start Unfiled. */}
          <div className="mt-4">
            <ContentImportForm />
          </div>

          {/* Import straight from the connected Vimeo account — pick the videos
              that belong and they come in as drafts with metadata + thumbnails. */}
          <div className="mt-4">
            <BrainVimeoImport folderId={activeFolder?.id} folderName={activeFolder?.name} />
          </div>

          {/* ---- Publish all drafts in this view (one-click go-live) ---- */}
          {draftIds.length > 0 && (
            <div className="mt-4">
              <BrainPublishAll draftIds={draftIds} />
            </div>
          )}

          {/* ---- Auto-organise (AI batch: propose folder + tags, admin approves) ---- */}
          {visible.length > 0 && (
            <div className="mt-4">
              <BrainAutoOrganize
                itemIds={visible.map((i) => i.id)}
                folderNames={folders.map((f) => f.name)}
                aiConfigured={aiConfigured}
              />
            </div>
          )}

          {/* ---- Item grid ---- */}
          {visible.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              {view === "all"
                ? "Nothing in the Brain yet — add your first piece above."
                : "Nothing here yet — add a piece above, or move items in from another folder."}
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <li key={item.id} className="flex flex-col border border-rule-border">
                  <BrainThumb item={item} assetUrl={assetUrls[item.id]} />
                  <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        {TYPE_LABEL[item.type]} · {CATEGORY_LABEL[item.category]}
                        {item.day_of_week ? ` · ${DAY_LABEL[item.day_of_week]}` : ""}
                      </span>
                      <span
                        className={
                          "shrink-0 border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] " +
                          (item.is_published
                            ? "border-rule-border text-muted"
                            : "border-brand-accent bg-brand-accent text-brand-accent-foreground")
                        }
                      >
                        {item.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <p className="font-extrabold leading-tight tracking-tight">{item.title}</p>
                    {item.summary && (
                      <p
                        className={`text-xs text-muted ${
                          item.type === "text" ? "line-clamp-4" : "line-clamp-2"
                        }`}
                      >
                        {item.summary}
                      </p>
                    )}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 6).map((tag) => (
                          <span key={tag} className="border border-rule-hairline px-1.5 py-0.5 text-[10px] text-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto space-y-2 border-t border-rule-hairline pt-2">
                      <BrainMoveControl itemId={item.id} folderId={item.folder_id} folders={folderOptions} />
                      <ContentItemActions id={item.id} isPublished={item.is_published} title={item.title} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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

/**
 * The card's media preview. Images render inline (content-assets public URL or
 * an external image URL); a video renders its captured still (e.g. the Vimeo
 * thumbnail) with a ▶ overlay, falling back to a glyph tile when no still was
 * captured; a document shows a typed glyph tile — the Brain is a management
 * grid, not a player, so a poster/label reads faster than an embed.
 */
function BrainThumb({ item, assetUrl }: { item: ContentItem; assetUrl?: string }) {
  // A text item (a journal principle / prompt / quote) carries no media — its
  // title and summary are the whole card — so it gets no media tile at all and
  // the card leads straight with its content. An empty 16:9 "TEXT" placeholder
  // was pure dead space in a Brain that's now mostly text. Video/image/document
  // keep a real preview (thumbnail or a typed glyph tile).
  if (item.type === "text") return null;

  // Poster: an image's own asset, or a video's captured thumbnail (Vimeo).
  const imageSrc =
    item.type === "image"
      ? assetUrl ?? item.external_url ?? null
      : item.type === "video"
        ? item.thumbnail_url ?? null
        : null;

  if (imageSrc) {
    return (
      <div className="relative aspect-video w-full border-b border-rule-hairline">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote/derived URL, not a local/optimizable asset */}
        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        {item.type === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/70 text-sm text-background">
              ▶
            </span>
          </span>
        )}
      </div>
    );
  }

  const glyph = item.type === "video" ? "▶" : "PDF";
  return (
    <div className="flex aspect-video w-full items-center justify-center border-b border-rule-hairline bg-foreground/[0.03]">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted">{glyph}</span>
    </div>
  );
}
