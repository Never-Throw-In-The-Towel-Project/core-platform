import { type ReactNode } from "react";

/**
 * Shared form primitives in the "Modernist" token language (flat, ink-on-paper,
 * a single red accent, zero radius). One home for accessible label + control +
 * inline-error wiring so every form reads the same and no field ever surfaces an
 * error without an `aria-invalid` + `aria-describedby` link to its message.
 *
 * Presentational only (no hooks): safe to render from client forms. The event
 * authoring form and the guest booking form both build on these.
 */

const LABEL_CLASS = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted";
const BASE_INPUT =
  "mt-1 w-full border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted/60";

/** The "(optional)" adornment used beside a label. */
export const OptionalTag = (
  <span className="font-semibold normal-case tracking-normal text-muted">(optional)</span>
);

function controlClass(invalid: boolean | undefined, extra?: string): string {
  const edge = invalid ? "border-brand-accent-deep" : "border-rule-border focus:border-foreground";
  return `${BASE_INPUT} ${edge} ${extra ?? ""}`.trim();
}

/** The red inline error line for a field. `id` is referenced by aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-semibold text-brand-accent-deep">
      {children}
    </p>
  );
}

type FieldLabelProps = {
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
  /** Right-aligned adornment (e.g. a live character count or a helper link). */
  right?: ReactNode;
};

function FieldLabel({ htmlFor, children, optional, right }: FieldLabelProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
        {children} {optional ? OptionalTag : null}
      </label>
      {right ? <span className="text-[11px] font-semibold text-muted">{right}</span> : null}
    </div>
  );
}

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: ReactNode;
  error?: string;
  optional?: boolean;
  /** Grey helper text under the control, hidden while an error is showing. */
  hint?: ReactNode;
  /** Right-aligned label adornment. */
  right?: ReactNode;
  /** Class on the wrapping <div>, e.g. grid spans. */
  wrapClassName?: string;
};

/** Labelled text/url/number/datetime input with an inline error slot. */
export function TextField({
  id,
  label,
  error,
  optional,
  hint,
  right,
  wrapClassName,
  className,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = error ? errorId : hintId;
  return (
    <div className={wrapClassName}>
      <FieldLabel htmlFor={id} optional={optional} right={right}>
        {label}
      </FieldLabel>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={controlClass(Boolean(error), className)}
        {...inputProps}
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

type TextAreaFieldProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: ReactNode;
  error?: string;
  optional?: boolean;
  hint?: ReactNode;
  right?: ReactNode;
  wrapClassName?: string;
};

/** Labelled multi-line input with an inline error slot. */
export function TextAreaField({
  id,
  label,
  error,
  optional,
  hint,
  right,
  wrapClassName,
  className,
  ...areaProps
}: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = error ? errorId : hintId;
  return (
    <div className={wrapClassName}>
      <FieldLabel htmlFor={id} optional={optional} right={right}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={controlClass(Boolean(error), `resize-y ${className ?? ""}`)}
        {...areaProps}
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

/** A titled group of fields: an ink eyebrow + optional description, then content. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-rule-hairline pb-2">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em]">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A flat, accessible on/off switch bound to a boolean. Renders no native
 *  checkbox; the caller serialises the value into FormData itself. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  id: string;
}) {
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-extrabold">
          {label}
        </label>
        {description ? (
          <p id={descId} className="mt-0.5 text-xs text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-describedby={descId}
        onClick={() => onChange(!checked)}
        className={
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center border transition-colors " +
          (checked ? "border-brand-accent bg-brand-accent" : "border-rule-border bg-transparent")
        }
      >
        <span
          className={
            "block h-4 w-4 bg-foreground transition-transform " +
            (checked ? "translate-x-6 bg-brand-accent-foreground" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
