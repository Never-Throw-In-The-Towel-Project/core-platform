/**
 * A round initial-avatar for community authors. A solid ink circle with a light
 * initial -- gives the feed the avatar-led, social look without introducing
 * off-palette colours. Size is set by the caller via `className` (h/w/text).
 */
export function Avatar({ name, className = "h-10 w-10 text-sm" }: { name: string; className?: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-foreground font-extrabold leading-none text-background ${className}`}
    >
      {initial}
    </span>
  );
}
