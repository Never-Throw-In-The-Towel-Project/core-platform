/**
 * The step number (1, 2, 3) on a Today routine card and the hero -- a bold,
 * unmissable red square at the START of the card that mirrors the completion
 * tick at the END, so the daily sequence reads at a glance: do 1, then 2, then
 * 3. Sized to match the tick (h-12 w-12). The numbers are fixed to the daily
 * slot (Morning = 1, midday check-in = 2, Night = 3), not the render order, so
 * "1" always means the morning whichever card is currently the hero. Announced
 * as "Step N" to screen readers.
 */
export function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-brand-accent text-2xl font-extrabold leading-none text-brand-accent-foreground">
      <span className="sr-only">Step </span>
      {n}
    </span>
  );
}
