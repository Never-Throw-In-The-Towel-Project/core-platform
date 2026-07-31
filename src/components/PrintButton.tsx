"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-accent-foreground print:hidden"
    >
      Download / Print
    </button>
  );
}
