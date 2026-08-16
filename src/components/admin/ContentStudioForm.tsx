"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createContentItem, updateContentItem } from "@/lib/actions/content";
import { suggestTagsAction } from "@/lib/actions/aiStudio";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { ContentItem, ContentType } from "@/types/database";

const LABEL = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const FIELD = "mt-1 w-full border border-rule-border bg-transparent px-3 py-2 text-sm";

const DAYS: { value: string; label: string }[] = [
  { value: "", label: "Any day" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DOC_ACCEPT = "application/pdf";

/**
 * The Super Admin content composer -- add a content item, tag it (theme, day,
 * tags), target it to channels, and publish. The `type` is client state so the
 * right media input shows (Vimeo id for video; a file upload / external link
 * for document/image). Everything is enforced again server-side and by RLS;
 * this is the friendly surface, not the boundary.
 *
 * The theme/day/tags fields are controlled so the assistive "Suggest tags"
 * button can fill them from the title + summary. That is the ONLY thing the AI
 * does here: it proposes; the admin edits and presses Add. It never publishes.
 *
 * Dual-mode: pass an `item` (+ its `existingChannelIds`) to edit it instead of
 * creating a new one -- fields prefill and submit to updateContentItem, which
 * redirects back to the Studio. With no `item` the create path is unchanged.
 */
export function ContentStudioForm({
  companies,
  item,
  existingChannelIds = [],
  folderId,
  scheduledFor,
  defaultDayOfWeek,
  bare = false,
}: {
  companies: { id: string; name: string }[];
  item?: ContentItem;
  existingChannelIds?: string[];
  /** When creating from the Brain, file the new item straight into this folder
   *  (createContentItem reads `folderId`). Ignored in edit mode — folder moves
   *  for an existing item go through moveItemToFolder. */
  folderId?: string | null;
  /** When adding onto a calendar date: pre-set the publish date (createContentItem
   *  reads `scheduledFor`) and default to a scheduled draft. Create mode only. */
  scheduledFor?: string;
  /** When adding onto a weekday column: pre-select the day-of-week. Create mode only. */
  defaultDayOfWeek?: number;
  /** Drop the form's own border/padding when it already sits inside a card (the
   *  Content Studio "New piece" panel) — avoids a doubled frame. */
  bare?: boolean;
}) {
  const isEdit = item != null;
  // The weekday a fresh add starts on (calendar Week-add), else blank.
  const initialDay =
    item?.day_of_week != null
      ? String(item.day_of_week)
      : defaultDayOfWeek != null && defaultDayOfWeek >= 1 && defaultDayOfWeek <= 7
        ? String(defaultDayOfWeek)
        : "";
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateContentItem : createContentItem,
    initialRoutineState
  );
  const [type, setType] = useState<ContentType>(item?.type ?? "video");
  const formRef = useRef<HTMLFormElement>(null);

  // Controlled so the AI suggestion can populate them (and so a suggestion is
  // always editable before it's committed). Prefilled from `item` when editing.
  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? "mental_fitness");
  const [dayOfWeek, setDayOfWeek] = useState(initialDay);
  const [tags, setTags] = useState(item?.tags.join(", ") ?? "");

  const [suggestPending, startSuggest] = useTransition();
  const [suggestNote, setSuggestNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    // formRef.reset() clears the UNCONTROLLED fields (media inputs, channels,
    // publish) -- a DOM side effect, so it belongs in an effect. The controlled
    // fields are reset via the during-render pattern below. `type` is left as-is
    // -- an admin adding several of the same type shouldn't have it snap back.
    // Edit mode redirects on success, so there's nothing to reset there.
    if (!isEdit && state.status === "success") formRef.current?.reset();
  }, [state, isEdit]);

  // Reset the controlled fields on a fresh success by adjusting state during
  // render (React's documented pattern -- see PostCard) rather than in an
  // effect, which would trip the cascading-render rule.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (!isEdit && state.status === "success") {
      setTitle("");
      setSummary("");
      setCategory("mental_fitness");
      // Keep the calendar-add day so several pieces can be added to the same slot.
      setDayOfWeek(initialDay);
      setTags("");
      setSuggestNote(null);
    }
  }

  function handleSuggest() {
    setSuggestNote(null);
    startSuggest(async () => {
      const result = await suggestTagsAction({ title, summary });
      if (result.status === "ok") {
        const s = result.suggestion;
        setCategory(s.category);
        setDayOfWeek(s.day_of_week != null ? String(s.day_of_week) : "");
        setTags(s.tags.join(", "));
        setSuggestNote({ kind: "ok", text: s.rationale || "Suggested — edit anything before you add it." });
      } else {
        setSuggestNote({ kind: "error", text: result.message });
      }
    });
  }

  return (
    <form ref={formRef} action={formAction} className={bare ? "space-y-5" : "space-y-5 border border-rule-border p-5"}>
      {isEdit && <input type="hidden" name="id" value={item.id} />}
      {!isEdit && folderId && <input type="hidden" name="folderId" value={folderId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="content-type" className={LABEL}>
            Type
          </label>
          <select
            id="content-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as ContentType)}
            className={FIELD}
          >
            <option value="video">Video</option>
            <option value="document">Document (PDF)</option>
            <option value="image">Image</option>
          </select>
        </div>
        <div>
          <label htmlFor="content-category" className={LABEL}>
            Theme
          </label>
          <select
            id="content-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD}
          >
            <option value="mental_fitness">Mental Fitness</option>
            <option value="physical_fitness">Physical Fitness</option>
            <option value="nutrition">Nutrition</option>
            <option value="tools_tips">Tools &amp; Tips</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="content-title" className={LABEL}>
          Title
        </label>
        <input
          id="content-title"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={FIELD}
        />
      </div>

      {/* Media, by type. */}
      {type === "video" ? (
        <div>
          <label htmlFor="content-vimeo" className={LABEL}>
            Vimeo ID
          </label>
          <input
            id="content-vimeo"
            name="vimeoId"
            placeholder="e.g. 123456789"
            defaultValue={item?.vimeo_id ?? ""}
            className={FIELD}
            inputMode="numeric"
          />
          <p className="mt-1 text-xs text-muted">The numeric ID from the Vimeo URL.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {isEdit && item.asset_path && (
            <p className="text-xs text-muted">
              Current file uploaded. Choose a new one to replace it, or leave both fields blank to keep it.
            </p>
          )}
          <div>
            <label htmlFor="content-asset" className={LABEL}>
              Upload {type === "document" ? "a PDF" : "an image"}
            </label>
            <input
              id="content-asset"
              name="asset"
              type="file"
              accept={type === "document" ? DOC_ACCEPT : IMAGE_ACCEPT}
              className="mt-1 w-full text-xs file:mr-3 file:border file:border-rule-border file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            />
            <p className="mt-1 text-xs text-muted">
              {type === "document" ? "PDF, up to 25MB." : "JPEG, PNG, WebP, or GIF, up to 25MB."}
            </p>
          </div>
          <div>
            <label htmlFor="content-url" className={LABEL}>
              …or an external link
            </label>
            <input
              id="content-url"
              name="externalUrl"
              placeholder="https://…"
              defaultValue={item?.external_url ?? ""}
              className={FIELD}
            />
          </div>
        </div>
      )}

      {/* Assistive tagging: proposes theme, day & tags from the title/summary.
          The admin confirms and edits -- it never writes or publishes. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggestPending || title.trim().length === 0}
          className="border border-rule-border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep transition-colors hover:bg-foreground/[0.03] disabled:opacity-40"
        >
          {suggestPending ? "Suggesting…" : "Suggest theme, day & tags"}
        </button>
        {suggestNote && (
          <p
            className={`text-xs ${suggestNote.kind === "error" ? "text-brand-accent-deep" : "text-muted"}`}
            role="status"
          >
            {suggestNote.text}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="content-day" className={LABEL}>
            Day of week
          </label>
          <select
            id="content-day"
            name="dayOfWeek"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className={FIELD}
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="content-tags" className={LABEL}>
            Tags
          </label>
          <input
            id="content-tags"
            name="tags"
            placeholder="grief, sleep, comma-separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="content-summary" className={LABEL}>
          Summary <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="content-summary"
          name="summary"
          rows={2}
          maxLength={1000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className={`${FIELD} resize-y`}
        />
      </div>

      <fieldset>
        <legend className={LABEL}>Channels</legend>
        <p className="mt-1 text-xs text-muted">Leave all unchecked for NTITT-wide (everyone). Tick a partner to target it there.</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {companies.length === 0 ? (
            <span className="text-xs text-muted">No partner channels yet.</span>
          ) : (
            companies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="channels"
                  value={c.id}
                  defaultChecked={existingChannelIds.includes(c.id)}
                  className="h-4 w-4"
                />
                {c.name}
              </label>
            ))
          )}
        </div>
      </fieldset>

      {!isEdit && scheduledFor !== undefined && (
        <div>
          <label htmlFor="content-scheduled" className={LABEL}>
            Publish date
          </label>
          <input
            id="content-scheduled"
            name="scheduledFor"
            type="date"
            defaultValue={scheduledFor}
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted">
            Goes live automatically on this date. Leave “Publish now” unchecked to keep it a scheduled draft until then.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="publish"
          value="true"
          // A calendar-scheduled add defaults to a draft (the cron takes it live
          // on its date); everything else defaults to publish-now.
          defaultChecked={item ? item.is_published : scheduledFor === undefined}
          className="h-4 w-4"
        />
        Publish now (uncheck to save as a draft)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add content"}
        </button>
        {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
        {!isEdit && state.status === "success" && (
          <p className="text-sm font-semibold text-foreground" role="status">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
