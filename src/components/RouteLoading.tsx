/**
 * Route-segment loading fallback (used by each authenticated segment's
 * `loading.tsx`). Several journeys do multiple sequential Supabase awaits before
 * first paint (e.g. /home, /journey, /content); without a Suspense boundary that
 * is a blank screen on a slow round-trip. This is a lightweight, theme-neutral
 * placeholder -- it uses `currentColor` + brand/muted tokens, so it reads
 * correctly on both the dark member app and the light Workspace/admin shells.
 * The surrounding layout chrome (header, nav) stays put; only the page body
 * inside the boundary shows this while it streams.
 */
export function RouteLoading() {
  return (
    <main
      className="flex min-h-[60vh] items-center justify-center px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-current/20 border-t-brand-accent"
          aria-hidden="true"
        />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          Loading…
        </span>
      </div>
    </main>
  );
}
