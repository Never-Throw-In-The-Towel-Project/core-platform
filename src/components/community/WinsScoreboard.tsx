// A live "scoreboard" for the Wins Board hero, replacing the old decorative
// group photo. It always leads with a POSITIVE number: this week's tally when
// there is one, otherwise the all-time total (so a fresh Monday never shows a
// deflating "0"), and a distinct fresh-board state before any win exists. Pure
// + server-safe; the counts come from countWinsPosts(). Ink-band tokens only.

const nf = new Intl.NumberFormat("en-GB");

/** A clean, flat trophy mark in the vivid accent — the "winning" cue. */
function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {/* cup */}
        <path d="M15 8h18v7a9 9 0 0 1-18 0z" />
        {/* handles */}
        <path d="M15 10h-4a4 4 0 0 0 4 7" />
        <path d="M33 10h4a4 4 0 0 1-4 7" />
        {/* stem + base */}
        <path d="M24 24v6" />
        <path d="M17 38h14l-2-8H19z" />
        <path d="M14 40h20" />
      </g>
    </svg>
  );
}

export function WinsScoreboard({ thisWeek, allTime }: { thisWeek: number; allTime: number }) {
  // Fresh board — nothing posted ever. Show the mark, not a bare zero.
  if (allTime <= 0) {
    return (
      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2 sm:text-right">
        <Trophy className="h-12 w-12 text-brand-accent-light-2" />
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
            The board is fresh
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-on-ink-2">Your wins tally here.</p>
        </div>
      </div>
    );
  }

  const leadWithWeek = thisWeek > 0;
  const heroValue = leadWithWeek ? thisWeek : allTime;
  const heroLabel = leadWithWeek ? "Wins this week" : "Wins all-time";
  const secondary = leadWithWeek
    ? `${nf.format(allTime)} all-time`
    : "New week — add the first";

  return (
    <div className="flex flex-col gap-2 sm:items-end sm:text-right">
      <div className="flex items-center gap-3 sm:flex-row-reverse">
        <Trophy className="h-8 w-8 shrink-0 text-brand-accent-light-2" />
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-accent-light-2">
          {heroLabel}
        </p>
      </div>
      <p className="text-6xl font-extrabold leading-none tracking-tight tabular-nums text-brand-foreground sm:text-7xl">
        {nf.format(heroValue)}
      </p>
      <p className="mt-1 border-t border-ink-hairline pt-2 text-sm font-semibold text-muted-on-ink-2">
        {secondary}
      </p>
    </div>
  );
}
