"use client";

import { useRouter } from "next/navigation";

/**
 * Channel filter for the distribution calendar. A <select> that navigates to the
 * chosen channel's URL (built server-side so it preserves the current view/month),
 * letting Anthony's team plan the week/month as one partner's members see it.
 */
export function CalendarChannelSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="calendar-channel" className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
        Channel
      </label>
      <select
        id="calendar-channel"
        value={value}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) router.push(opt.href);
        }}
        className="border border-rule-border bg-transparent px-2 py-1 text-xs font-semibold"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
