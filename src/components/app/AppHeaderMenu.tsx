"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import type { UserRole } from "@/types/database";

/**
 * The app header's account menu. Two triggers, same menu:
 *  - `avatar`  — the desktop account chip (the member's initial), holding the
 *    role links (Workspace / Control Tower) and Sign out. Settings has its own
 *    gear next to it, so it's omitted here (`includeSettings={false}`).
 *  - `hamburger` — the mobile "☰", where the same items plus Settings collapse
 *    (there's no room for a gear + avatar + support on a phone; support is the
 *    inline bar above the bottom tab bar).
 *
 * A small accessible dropdown: toggles on the button, closes on outside-click,
 * Escape, or following a link. Sign out is a server action (there was no
 * sign-out anywhere in the app before this).
 */
export function AppHeaderMenu({
  role,
  trigger,
  initial,
  includeSettings = true,
}: {
  role: UserRole;
  trigger: "avatar" | "hamburger";
  initial?: string;
  includeSettings?: boolean;
}) {
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
    "block w-full px-4 py-2.5 text-left text-xs font-semibold text-brand-foreground/80 hover:bg-white/5 hover:text-brand-foreground";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={trigger === "avatar" ? "Account menu" : "Menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          trigger === "avatar"
            ? "grid h-8 w-8 place-items-center border border-ink-hairline text-xs font-extrabold text-brand-foreground hover:bg-white/5"
            : "grid h-8 w-8 place-items-center text-brand-foreground/80 hover:text-brand-foreground"
        }
      >
        {trigger === "avatar" ? (
          <span aria-hidden>{initial ?? "?"}</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
        )}
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
          {includeSettings && (
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={itemClass}>
              Settings
            </Link>
          )}
          <form action={signOut}>
            <button role="menuitem" type="submit" className={itemClass}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
