"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The shared "you finished it" screen every daily routine / check-in shows on a
 * successful submit. A green success tick (the same --success accent as Clean
 * Streak) celebrates the win, then it loops the member back to the Today board
 * after a short beat rather than stranding them on a dead-end screen.
 *
 * `router.replace` (not push) so the Back button from Today doesn't return to
 * the just-submitted form. The manual "Back to Today now" link is the instant
 * path + the fallback if a browser ever blocks the timed navigation; role=status
 * announces the whole celebration to screen readers.
 */
const REDIRECT_MS = 2000;

export function RoutineComplete({ title }: { title: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/home"), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center" role="status" aria-live="polite">
      <span
        className="flex h-16 w-16 items-center justify-center bg-success text-success-foreground"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" strokeLinecap="square" />
        </svg>
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-sm text-muted">Taking you back to Today…</p>
      <Link
        href="/home"
        className="text-xs font-extrabold uppercase tracking-wide text-brand-accent-deep underline"
      >
        Back to Today now →
      </Link>
    </div>
  );
}
