"use client";

import { useState } from "react";
import { FieldError, OptionalTag } from "./form";

const LABEL_CLASS = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const ACCEPT = "video/mp4,video/webm,video/quicktime,video/ogg";

/**
 * A video picker in the form-primitive language: click OR drag-and-drop to
 * choose a file, a live `<video>` preview, an "uploading" state while the file
 * streams direct to Storage, and a Remove control. Like ImageUploadField, the
 * parent owns all state — it computes `previewUrl` (a local object URL of the
 * picked file, or the existing video's public URL), runs the direct upload, and
 * serialises the resulting path into its own FormData; this component only
 * reports selection/removal and renders.
 */
export function VideoUploadField({
  id,
  label,
  optional,
  error,
  hint,
  previewUrl,
  fileLabel,
  uploading,
  onSelect,
  onRemove,
}: {
  id: string;
  label: React.ReactNode;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  /** Object URL of a picked file, or the existing video URL — or null for empty. */
  previewUrl: string | null;
  /** Caption under the preview (e.g. "clip.mp4 · 12.4 MB", or "Current video"). */
  fileLabel: string | null;
  /** True while the picked file is uploading to Storage. */
  uploading?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (f) onSelect(f);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span id={`${id}-label`} className={LABEL_CLASS}>
          {label} {optional ? OptionalTag : null}
        </span>
        {previewUrl && !uploading ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) pick(e.dataTransfer.files);
        }}
        className={
          "mt-1 border transition-colors " +
          (error
            ? "border-brand-accent-deep"
            : dragging
              ? "border-foreground bg-foreground/[0.03]"
              : "border-rule-border")
        }
      >
        {previewUrl ? (
          <div>
            <div className="aspect-video w-full overflow-hidden bg-brand-background">
              <video src={previewUrl} controls preload="metadata" className="h-full w-full">
                <track kind="captions" />
              </video>
            </div>
            <label
              htmlFor={id}
              className={
                "flex items-center justify-between gap-3 border-t border-rule-hairline px-3 py-2 text-xs font-semibold text-muted " +
                (uploading ? "cursor-default" : "cursor-pointer hover:text-foreground")
              }
            >
              <span className="truncate">{fileLabel ?? "Video"}</span>
              <span className="shrink-0 uppercase tracking-wide">{uploading ? "Uploading…" : "Replace"}</span>
            </label>
          </div>
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8 text-center"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted">
              <rect x="3" y="5" width="18" height="14" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
            </svg>
            <span className="text-sm font-semibold text-foreground">
              {uploading ? "Uploading…" : "Click to upload or drag a video here"}
            </span>
            <span className="text-xs text-muted">MP4, WebM, MOV or OGG · up to 200MB</span>
          </label>
        )}
      </div>

      <input
        id={id}
        type="file"
        accept={ACCEPT}
        aria-labelledby={`${id}-label`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hintId}
        disabled={uploading}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ""; // let the same file be re-picked after removal
        }}
      />

      {hint && !error ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
