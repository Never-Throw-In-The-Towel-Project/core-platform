/**
 * A thin confirmed/capacity meter, shared by the admin list rows and the event
 * detail header. Unlimited events (capacity null) show a plain tally instead of
 * a bar. The fill uses the decorative vivid accent (no text sits on it, so it's
 * exempt from AA text-contrast); a full event turns its label deep-red.
 */
export function CapacityMeter({
  confirmed,
  capacity,
  className,
}: {
  confirmed: number;
  capacity: number | null;
  className?: string;
}) {
  if (capacity == null) {
    return (
      <p className={`text-[11px] font-semibold uppercase tracking-wide text-muted ${className ?? ""}`}>
        {confirmed} booked · unlimited
      </p>
    );
  }

  const pct = capacity > 0 ? Math.min(100, Math.round((confirmed / capacity) * 100)) : 0;
  const full = confirmed >= capacity;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className={full ? "text-brand-accent-deep" : "text-muted"}>
          {confirmed} / {capacity} booked
        </span>
        {full ? <span className="text-brand-accent-deep">Full</span> : null}
      </div>
      <div className="mt-1 h-1.5 w-full bg-rule-hairline" aria-hidden="true">
        <div className="h-full bg-brand-accent-vivid" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
