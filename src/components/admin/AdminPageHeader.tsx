import { type ReactNode } from "react";

/**
 * The shared Admin Centre page header: a big title, an optional description, and
 * a right-aligned scope label, all sitting on a heavy ink rule. One component so
 * every admin page reads the same (and the shell breadcrumb already names the
 * section, so pages no longer carry their own red "Admin" eyebrow).
 */
export function AdminPageHeader({
  title,
  description,
  scope = "Platform-wide",
}: {
  title: string;
  description?: ReactNode;
  /** Right-aligned SCOPE value; pass null to omit. Defaults to "Platform-wide"
   *  since the Admin Centre acts across every workspace. */
  scope?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-foreground pb-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p> : null}
      </div>
      {scope ? (
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">Scope</p>
          <p className="text-sm font-extrabold">{scope}</p>
        </div>
      ) : null}
    </div>
  );
}
