"use client";

import { useState } from "react";
import { FieldError, OptionalTag } from "./form";

const LABEL_CLASS = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/**
 * An image picker in the form-primitive language: click OR drag-and-drop to
 * choose a file, a live thumbnail, the file label, and a Remove control. The
 * parent owns all state -- it computes `previewUrl` (the object URL of a picked
 * File or the existing image) and serialises the File into its own FormData;
 * this component only reports selection/removal and renders. Keeping the object
 * URL in the parent means it's created once and shared with the live preview
 * card, and revoked in one place.
 */
export function ImageUploadField({
  id,
  label,
  optional,
  error,
  hint,
  previewUrl,
  fileLabel,
  onSelect,
  onRemove,
}: {
  id: string;
  label: React.ReactNode;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  /** Object URL of a picked file, or the existing image URL — or null for empty. */
  previewUrl: string | null;
  /** Caption under the thumbnail (e.g. "photo.jpg · 1.2 MB", or "Current image"). */
  fileLabel: string | null;
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
        {previewUrl ? (
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
          pick(e.dataTransfer.files);
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
            <div className="aspect-[16/9] w-full overflow-hidden bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL / admin-pasted URL preview */}
              <img src={previewUrl} alt="Event image preview" className="h-full w-full object-cover" />
            </div>
            <label
              htmlFor={id}
              className="flex cursor-pointer items-center justify-between gap-3 border-t border-rule-hairline px-3 py-2 text-xs font-semibold text-muted hover:text-foreground"
            >
              <span className="truncate">{fileLabel ?? "Image"}</span>
              <span className="shrink-0 uppercase tracking-wide">Replace</span>
            </label>
          </div>
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8 text-center"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted">
              <rect x="3" y="4" width="18" height="16" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="9.5" r="1.75" fill="currentColor" />
              <path d="M4 18l5-5 4 4 3.5-3.5L20 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <span className="text-sm font-semibold text-foreground">Click to upload or drag an image here</span>
            <span className="text-xs text-muted">JPEG, PNG, WebP or GIF · up to 5MB</span>
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
