import type { Badge, BadgeStatsInput } from "@/lib/gamification/badges";
import { badgeLabel, badgeProgressHint } from "@/lib/gamification/badges";
import { ShareBadgeButton } from "./ShareBadgeButton";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The Journey badges grid, per the 5-journey design: the full catalogue as a
 * two-column grid -- earned badges ink-filled with their date and a Share
 * control, locked ones outlined with a non-punitive "what's left" hint --
 * followed by any earned challenge badges, which are awarded outside the
 * catalogue (Team MVP / Challenge Complete) and so are always shown as earned.
 *
 * Everything here is private to the member; Share is the only path that surfaces
 * a badge to the community wins board, and only when they've joined the
 * community (`canShare`).
 */
export function JourneyBadges({
  badges,
  statsInput,
  earnedAt,
  sharedKeys,
  canShare,
  challengeBadges,
}: {
  badges: Badge[];
  statsInput: BadgeStatsInput;
  earnedAt: Map<string, string>;
  sharedKeys: Set<string>;
  canShare: boolean;
  challengeBadges: { key: string; earnedAt: string }[];
}) {
  const earnedCount = badges.filter((b) => b.earned).length;

  const shareSlot = (key: string) =>
    sharedKeys.has(key) ? (
      <span className="font-semibold text-brand-accent-light">Shared ✓</span>
    ) : canShare ? (
      <ShareBadgeButton badgeKey={key} onDark />
    ) : null;

  const earnedCard = (key: string, label: string, date: string | null) => (
    <div key={key} className="border-2 border-foreground bg-brand-background p-3 text-brand-foreground">
      <p className="text-[11px] font-extrabold uppercase leading-tight tracking-wide">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-on-ink">{date ? shortDate(date) : "Earned"}</span>
        {shareSlot(key)}
      </div>
    </div>
  );

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Badges</h2>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
          {earnedCount} of {badges.length} earned
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {badges.map((b) =>
          b.earned ? (
            earnedCard(b.key, b.label, earnedAt.get(b.key) ?? null)
          ) : (
            <div key={b.key} className="border border-rule-hairline p-3">
              <p className="text-[11px] font-extrabold uppercase leading-tight tracking-wide text-muted">{b.label}</p>
              <p className="mt-2 text-[11px] text-muted">{badgeProgressHint(b.key, statsInput)}</p>
            </div>
          )
        )}

        {challengeBadges.map((c) => earnedCard(c.key, badgeLabel(c.key), c.earnedAt))}
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {canShare
          ? "Badges are private. Share one to put it on the wins board."
          : "Badges are private to you."}
      </p>
    </section>
  );
}
