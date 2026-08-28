import type { Badge, BadgeStatsInput } from "@/lib/gamification/badges";
import { AWARDED_BADGES, badgeProgressHint } from "@/lib/gamification/badges";
import { ShareBadgeButton } from "./ShareBadgeButton";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The Trophy Room -- the full-width Journey band that shows every badge the
 * member can earn as they move through the NTITT journey. The whole catalogue is
 * on show at once: earned trophies are ink-filled (a black tile on the paper
 * page) with the date earned and a Share control; locked ones are outlined and
 * muted with an honest "what's next" line, so the room reads as the path ahead
 * rather than an empty showcase.
 *
 * It renders both the stat-derived catalogue (`badges`, evaluated live) and the
 * three awarded badges (`AWARDED_BADGES` -- Challenge Complete / Team MVP / Clean
 * Streak), which count as earned when a persisted row exists in `earnedAt`.
 *
 * Everything here is private to the member; Share is the only path that puts a
 * trophy on the community wins board, and only once they've joined the community
 * (`canShare`). Clean Streak never names the underlying habit.
 */
export function TrophyRoom({
  badges,
  statsInput,
  earnedAt,
  sharedKeys,
  canShare,
}: {
  badges: Badge[];
  statsInput: BadgeStatsInput;
  earnedAt: Map<string, string>;
  sharedKeys: Set<string>;
  canShare: boolean;
}) {
  const total = badges.length + AWARDED_BADGES.length;
  const earnedCount =
    badges.filter((b) => b.earned).length + AWARDED_BADGES.filter((a) => earnedAt.has(a.key)).length;
  const progress = total > 0 ? earnedCount / total : 0;

  const shareSlot = (key: string) =>
    sharedKeys.has(key) ? (
      <span className="font-semibold text-brand-accent-light">Shared ✓</span>
    ) : canShare ? (
      <ShareBadgeButton badgeKey={key} onDark />
    ) : null;

  const earnedTile = (key: string, label: string, description: string, date: string | null) => (
    <div key={key} className="flex flex-col border-2 border-foreground bg-brand-background p-4 text-brand-foreground">
      <p className="text-xs font-extrabold uppercase leading-tight tracking-wide">{label}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-on-ink">{description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[11px]">
        <span className="font-semibold text-muted-on-ink">{date ? `Earned ${shortDate(date)}` : "Earned"}</span>
        {shareSlot(key)}
      </div>
    </div>
  );

  const lockedTile = (key: string, label: string, description: string, hint: string) => (
    <div key={key} className="flex flex-col border border-rule-hairline p-4">
      <p className="text-xs font-extrabold uppercase leading-tight tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">{description}</p>
      <p className="mt-auto border-t border-rule-hairline pt-2 text-[11px] font-semibold text-brand-accent-deep">
        {hint}
      </p>
    </div>
  );

  return (
    <section aria-labelledby="trophy-room-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="trophy-room-heading" className="text-xl font-extrabold tracking-tight">
            Trophy Room
          </h2>
          <p className="mt-1 text-sm text-muted">
            Every trophy you earn as you move through the journey — all yours, all private.
          </p>
        </div>
        <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          {earnedCount} of {total} earned
        </p>
      </div>

      <div className="mt-3 h-1.5 bg-foreground/10" aria-hidden>
        <div className="h-full bg-brand-accent" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((b) =>
          b.earned
            ? earnedTile(b.key, b.label, b.description, earnedAt.get(b.key) ?? null)
            : lockedTile(b.key, b.label, b.description, badgeProgressHint(b.key, statsInput))
        )}
        {AWARDED_BADGES.map((a) =>
          earnedAt.has(a.key)
            ? earnedTile(a.key, a.label, a.description, earnedAt.get(a.key) ?? null)
            : lockedTile(a.key, a.label, a.description, a.earnHint)
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted">
        {canShare
          ? "Your trophies are private. Share one to put it on the community wins board."
          : "Your trophies are private to you."}
      </p>
    </section>
  );
}
