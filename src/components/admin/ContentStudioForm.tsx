"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createContentItem } from "@/lib/actions/content";
import { initialRoutineState } from "@/lib/actions/routineState";
import type { ContentType } from "@/types/database";

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
 */
export function ContentStudioForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createContentItem, initialRoutineState);
  const [type, setType] = useState<ContentType>("video");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Reset the uncontrolled fields on success (same pattern as PostComposer).
    // The `type` select is left as-is -- an admin adding several items of the
    // same type shouldn't have it snap back each time -- and resetting it here
    // would be a setState-in-effect anyway.
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5 border border-rule-border p-5">
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
          <select id="content-category" name="category" defaultValue="mental_fitness" className={FIELD}>
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
        <input id="content-title" name="title" required maxLength={200} className={FIELD} />
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
            className={FIELD}
            inputMode="numeric"
          />
          <p className="mt-1 text-xs text-muted">The numeric ID from the Vimeo URL.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
            <input id="content-url" name="externalUrl" placeholder="https://…" className={FIELD} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="content-day" className={LABEL}>
            Day of week
          </label>
          <select id="content-day" name="dayOfWeek" defaultValue="" className={FIELD}>
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
          <input id="content-tags" name="tags" placeholder="grief, sleep, comma-separated" className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="content-summary" className={LABEL}>
          Summary <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
        </label>
        <textarea id="content-summary" name="summary" rows={2} maxLength={1000} className={`${FIELD} resize-y`} />
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
                <input type="checkbox" name="channels" value={c.id} className="h-4 w-4" />
                {c.name}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="publish" value="true" defaultChecked className="h-4 w-4" />
        Publish now (uncheck to save as a draft)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Add content"}
        </button>
        {state.status === "error" && <p className="text-sm text-brand-accent-deep">{state.message}</p>}
        {state.status === "success" && (
          <p className="text-sm font-semibold text-foreground" role="status">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
