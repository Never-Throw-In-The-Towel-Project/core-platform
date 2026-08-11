/**
 * The conic-gradient progress ring from the Today progress band. Designed to
 * sit on the ink band: the centre disc is painted ink (bg-brand-background) so
 * it masks the middle of the conic gradient, leaving a clean arc with the
 * percentage floating in the centre -- matching the handoff's
 * `conic-gradient(#ec3013 0 40%, #444141 40% 100%)` with an ink centre.
 *
 * Uses --brand-accent-vivid (the true #ec3013): the arc is a decorative fill
 * with no small text ON it, so the AA text-contrast constraint that keeps
 * buttons on the darker --brand-accent doesn't apply here.
 */
export function ProgressRing({
  pct,
  size = 72,
  label,
}: {
  pct: number;
  size?: number;
  /** Accessible description of what the ring measures. */
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const inner = Math.round(size * 0.62);

  return (
    <div
      role="img"
      aria-label={`${clamped}% — ${label}`}
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--brand-accent-vivid) 0 ${clamped}%, var(--ink-hairline) ${clamped}% 100%)`,
      }}
    >
      <div
        className="absolute inset-0 m-auto flex items-center justify-center rounded-full bg-brand-background text-brand-foreground"
        style={{ width: inner, height: inner }}
      >
        <span className="text-xs font-extrabold tracking-tight">{clamped}%</span>
      </div>
    </div>
  );
}
