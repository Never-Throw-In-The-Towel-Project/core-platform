import Link from "next/link";

/**
 * A secondary routine / check-in card on Today, below the hero. It speaks the
 * same visual language as the hero CheckinCard -- the red 2px outline
 * (--brand-accent), a header strip, a big bold title, a subtitle and a trailing
 * completion tick -- so the whole board reads as one family.
 *
 * The hero still stays the loudest element (its solid-red header strip, larger
 * title, red START button and photo), so it remains the focal "do this now"
 * action while every card shares the red outline.
 *
 * The completion tick is the card's status: a filled accent tick when done, a
 * red-outlined box when still pending. When done, the subtitle (`meta`) may
 * carry the user's OWN private sleep score / day rating -- shown only here, on
 * their own screen, labelled "private to you", and never sent to a company
 * report.
 */
export function RoutineCard({
  eyebrow,
  label,
  meta,
  done,
  href,
  trailing,
}: {
  eyebrow: string;
  label: string;
  meta: string;
  done: boolean;
  href: string;
  trailing?: string;
}) {
  return (
    <Link
      href={href}
      className="block border-2 border-brand-accent bg-background transition-colors hover:bg-foreground/[0.03]"
    >
      {/* Muted header strip: the schedule/category on the left, the time or
          "Edit" status on the right. Quieter than the hero's solid-red strip so
          the hero stays the focal action, while the card shares its red border. */}
      <div className="flex items-center justify-between gap-3 border-b border-rule-hairline bg-foreground/[0.04] px-4 py-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{eyebrow}</span>
        {trailing && (
          <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">
            {trailing}
          </span>
        )}
      </div>
      {/* Body: the big bold title + subtitle, with the completion tick as the
          trailing accent (mirrors the hero's scale, one step down). */}
      <div className="flex items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{label}</h2>
          {meta && <p className="mt-1.5 text-sm text-foreground/70">{meta}</p>}
        </div>
        <span
          aria-hidden
          className={
            "flex h-12 w-12 shrink-0 items-center justify-center text-lg font-extrabold " +
            (done ? "bg-brand-accent-vivid text-white" : "border-2 border-brand-accent")
          }
        >
          {done ? "✓" : ""}
        </span>
      </div>
    </Link>
  );
}
