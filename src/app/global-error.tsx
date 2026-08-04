"use client";

import "./globals.css";

/**
 * Catches failures in the root layout itself (e.g. resolveCompanyForHost
 * throwing) -- error.tsx only wraps everything BELOW the root layout, per
 * node_modules/next/dist/docs/.../error.md ("It does not wrap the
 * layout.js... above it in the same segment"). Must define its own
 * <html>/<body> since it replaces the root layout when active, and can't
 * use next/font (no request context to hang a font load off here), so this
 * intentionally stays plain -- it only needs to be legible, not on-brand.
 */
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-sm">
          <h1 className="text-3xl font-extrabold uppercase">Something went wrong</h1>
          <p className="mt-3 text-sm opacity-80">
            That&apos;s on us, not you. Try reloading -- if it keeps happening and this is urgent
            right now, please call 116 123 (Samaritans, free, 24/7).
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-8 w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
