import type { EventRow } from "@/types/database";

export type EventStatus = "cancelled" | "draft" | "past" | "live";

type StatusInput = Pick<EventRow, "cancelled_at" | "is_published" | "starts_at" | "ends_at">;

/**
 * The single source of truth for an event's admin-facing status. Precedence:
 * cancelled > draft > past > live. "Past" keys off the end time when present
 * (an event is only over once it has ended), else the start time.
 */
export function eventStatus(e: StatusInput, nowMs: number): EventStatus {
  if (e.cancelled_at) return "cancelled";
  if (!e.is_published) return "draft";
  const endRef = e.ends_at ?? e.starts_at;
  if (new Date(endRef).getTime() < nowMs) return "past";
  return "live";
}

const STYLES: Record<EventStatus, { label: string; className: string }> = {
  cancelled: { label: "Cancelled", className: "border-brand-accent-deep text-brand-accent-deep" },
  draft: { label: "Draft", className: "border-brand-accent bg-brand-accent text-brand-accent-foreground" },
  past: { label: "Past", className: "border-rule-border text-muted" },
  live: { label: "Live", className: "border-foreground text-foreground" },
};

/** The flat status pill, shared by every admin/HR events surface. */
export function EventStatusBadge({ status }: { status: EventStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={
        "inline-flex shrink-0 border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] " +
        s.className
      }
    >
      {s.label}
    </span>
  );
}
