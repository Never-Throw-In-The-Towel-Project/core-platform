"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/types/database";

/**
 * The mobile "⋯ / ☰" menu for the app header. On phones the secondary header
 * actions (Settings, and the role links to the Workspace / Control Tower) would
 * otherwise wrap onto a second line; per the mobile designs they collapse into
 * this menu. Desktop keeps them inline (this is rendered only below `sm`).
 *
 * A small accessible dropdown: toggles on the button, closes on outside-click,
 * Escape, or following a link. The primary tabs are NOT here — they live in the
 * bottom tab bar on mobile — and support is the inline bar above that bar, so
 * this only carries Settings + the admin/HR entry points.
 */
export function AppHeaderMenu({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "block px-4 py-2.5 text-xs font-semibold text-brand-foreground/80 hover:bg-white/5 hover:text-brand-foreground";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center text-brand-foreground/80 hover:text-brand-foreground"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-44 border border-ink-hairline bg-brand-background py-1 shadow-lg"
        >
          {role === "hr_admin" && (
            <Link role="menuitem" href="/workspace" onClick={() => setOpen(false)} className={itemClass}>
              Workspace
            </Link>
          )}
          {role === "ntitt_admin" && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={itemClass}>
              NTITT Admin
            </Link>
          )}
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={itemClass}>
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
