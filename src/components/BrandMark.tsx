import Image from "next/image";

/**
 * The NTITT fist logomark (`public/logo-mark.png` — the official
 * NTITT-LOGOMARK-OUTLINE-TRANS artwork). It's a black-outline / white-fill mark
 * on a transparent background, so it reads as a *light* mark on dark backgrounds
 * shown as-is, and is inverted to read *dark* on light backgrounds — the same
 * convention the marketing surfaces already use (see MarketingNav / the landing
 * page). Pass `tone` to match the surface it sits on.
 *
 * This is the single source of truth for the brand mark in the app chrome, so
 * every header shows the same logo (not, say, a placeholder letter tile).
 */
export function BrandMark({
  tone,
  size = 24,
  className,
}: {
  tone: "onDark" | "onLight";
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt="Never Throw In The Towel"
      width={size}
      height={size}
      className={[tone === "onLight" ? "invert" : "", className].filter(Boolean).join(" ") || undefined}
    />
  );
}
