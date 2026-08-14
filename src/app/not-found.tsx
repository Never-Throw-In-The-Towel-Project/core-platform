import Link from "next/link";

// Branded 404 to match the invested-in error.tsx / global-error.tsx pages,
// instead of Next's default unstyled Not Found. Rendered inside the root
// layout, so it inherits the theme + background.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-accent-deep">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">This page isn&apos;t here</h1>
      <p className="max-w-md text-sm text-muted">
        The page you were looking for may have moved, or never existed. Let&apos;s get you back on track.
      </p>
      <Link
        href="/"
        className="mt-2 inline-block border border-current px-5 py-2 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background"
      >
        Back to safety
      </Link>
    </main>
  );
}
