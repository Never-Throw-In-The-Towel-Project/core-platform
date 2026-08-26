import Link from "next/link";

/**
 * A routine status row under the Today hero: a status box (a filled accent
 * tick when done, a quiet outlined box when still pending), the routine name,
 * and a meta line. When done, the meta may include the user's OWN private
 * sleep score / day rating -- shown only here, on their own screen, explicitly
 * labelled "private to you", and never sent to a company report.
 */
export function RoutineRow({
  label,
  meta,
  done,
  href,
  trailing,
}: {
  label: string;
  meta: string;
  done: boolean;
  href: string;
  trailing?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-t border-rule-hairline py-3 hover:bg-foreground/[0.03]"
    >
      <span
        aria-hidden
        className={
          "flex h-8 w-8 shrink-0 items-center justify-center text-sm font-extrabold " +
          (done
            ? "bg-brand-accent-vivid text-white"
            : "border-2 border-brand-accent text-muted")
        }
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">{label}</span>
        <span className="block text-xs text-muted">{meta}</span>
      </span>
      {trailing && (
        <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-brand-accent-deep">
          {trailing}
        </span>
      )}
    </Link>
  );
}
