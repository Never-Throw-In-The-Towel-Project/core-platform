import type { Badge } from "@/lib/gamification/badges";

/**
 * Badge grid for the Today right rail. Earned badges are ink-filled tiles;
 * locked ones are a 2px dashed outline that states the target without shaming
 * (there's no "you failed" state, only "not yet"). The badge catalogue and
 * thresholds live in lib/gamification/badges.ts and are still pending
 * Anthony's sign-off (see the note there).
 */
export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {badges.map((badge) => (
        <li
          key={badge.key}
          title={badge.description}
          className={
            "flex min-h-16 items-end p-2.5 text-[11px] font-extrabold uppercase leading-tight tracking-wide " +
            (badge.earned
              ? "bg-brand-background text-brand-foreground"
              : "border-2 border-dashed border-rule-border text-muted")
          }
        >
          <span>
            {badge.label}
            <span className="sr-only">{badge.earned ? " — earned" : " — locked"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
