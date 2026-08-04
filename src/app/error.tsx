"use client";

import { useEffect } from "react";

/**
 * Error boundary must be a Client Component (node_modules/next/dist/docs/
 * .../error.md) -- Next.js 16 wraps every page/layout below the root layout
 * in this automatically. Before this file existed there was NO error
 * boundary anywhere in the app: any unhandled exception in any Server
 * Component render (an unrecognized @supabase/auth-js failure, a
 * PostgREST hiccup, anything) fell all the way through to Next's own
 * generic, unstyled crash page with no way back in except a manual URL
 * edit. That's an unacceptable dead end on a platform people reach for
 * support. This can't fix the underlying cause of any given crash -- see
 * the guarded supabase.auth.* calls in lib/actions/auth.ts and
 * lib/auth/dal.ts for that -- but it makes sure a crash we haven't found
 * yet still leaves someone with a way forward instead of a blank wall.
 *
 * `unstable_retry` (not `reset`) is this Next version's preferred recovery
 * function -- re-fetches and re-renders the failed segment rather than just
 * clearing local error state. See node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/error.md.
 */
export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold uppercase">Something went wrong</h1>
        <p className="mt-3 text-sm opacity-80">
          That&apos;s on us, not you. Try again -- if it keeps happening, please reload from the
          start.
        </p>
        <p className="mt-3 text-sm opacity-80">
          If this is urgent right now, please call{" "}
          <span className="font-semibold">116 123 (Samaritans, free, 24/7)</span>.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-8 w-full bg-brand-accent px-4 py-3 text-sm font-semibold text-brand-accent-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
