import Link from "next/link";
import type { Badge, BadgeGroup, BadgeStatsInput } from "@/lib/gamification/badges";
import { AWARDED_BADGES, BADGE_GROUPS, badgeProgressHint } from "@/lib/gamification/badges";
import { ShareBadgeButton } from "./ShareBadgeButton";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Trophy = {
  key: string;
  label: string;
  description: string;
  group: BadgeGroup;
  earned: boolean;
  /** Earned date (null if earned-but-not-yet-persisted); ignored when locked. */
  date: string | null;
  /** "What's next" line shown when locked. */
  hint: string;
};

/**
 * The Trophy Room -- the full-width Journey band that shows every badge the
 * member can earn as they move through the NTITT journey, arranged into themed
 * shelves (Foundations / Habits & Routines / Movement / Community & Team) so it
 * reads like a trophy cabinet. Earned trophies are ink-filled (a black tile on
 * the paper page) with the date earned and a Share control; locked ones are
 * outlined and muted with an honest "what's next" line, so the room reads as the
 * path ahead rather than an empty showcase.
 *
 * It merges the stat-derived catalogue (`badges`, evaluated live) with the three
 * awarded badges (`AWARDED_BADGES` -- Challenge Complete / Team MVP / Clean
 * Streak), which count as earned when a persisted row exists in `earnedAt`, and
 * lays each on the shelf its `group` names.
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
  const trophies: Trophy[] = [
    ...badges.map((b) => ({
      key: b.key,
      label: b.label,
      description: b.description,
      group: b.group,
      earned: b.earned,
      date: earnedAt.get(b.key) ?? null,
      hint: badgeProgressHint(b.key, statsInput),
    })),
    ...AWARDED_BADGES.map((a) => ({
      key: a.key,
      label: a.label,
      description: a.description,
      group: a.group,
      earned: earnedAt.has(a.key),
      date: earnedAt.get(a.key) ?? null,
      hint: a.earnHint,
    })),
  ];

  const total = trophies.length;
  const earnedCount = trophies.filter((t) => t.earned).length;
  const progress = total > 0 ? earnedCount / total : 0;

  const shareSlot = (key: string) =>
    sharedKeys.has(key) ? (
      <span className="font-semibold text-brand-accent-light">Shared ✓</span>
    ) : canShare ? (
      <ShareBadgeButton badgeKey={key} onDark />
    ) : null;

  const tile = (t: Trophy) =>
    t.earned ? (
      <div key={t.key} className="flex flex-col border-2 border-foreground bg-brand-background p-4 text-brand-foreground">
        <p className="text-xs font-extrabold uppercase leading-tight tracking-wide">{t.label}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-on-ink">{t.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[11px]">
          <span className="font-semibold text-muted-on-ink">{t.date ? `Earned ${shortDate(t.date)}` : "Earned"}</span>
          {shareSlot(t.key)}
        </div>
      </div>
    ) : (
      <div key={t.key} className="flex flex-col border border-rule-hairline p-4">
        <p className="text-xs font-extrabold uppercase leading-tight tracking-wide text-muted">{t.label}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">{t.description}</p>
        <p className="mt-auto border-t border-rule-hairline pt-2 text-[11px] font-semibold text-brand-accent-deep">
          {t.hint}
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

      <div className="mt-6 space-y-8">
        {BADGE_GROUPS.map((g) => {
          const rows = trophies.filter((t) => t.group === g.key);
          if (rows.length === 0) return null;
          const shelfEarned = rows.filter((t) => t.earned).length;
          return (
            <div key={g.key}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{g.label}</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                  {shelfEarned}/{rows.length}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{rows.map(tile)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] text-muted">
          {canShare
            ? "Your trophies are private. Share one to put it on the community wins board."
            : "Your trophies are private to you."}
        </p>
        {canShare && (
          <Link
            href="/community/wins"
            className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep transition-opacity hover:opacity-80"
          >
            See the Wins Board →
          </Link>
        )}
      </div>
    </section>
  );
}
