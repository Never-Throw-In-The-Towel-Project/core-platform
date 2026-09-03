import type { CSSProperties } from "react";
import type { Company } from "@/types/database";

/**
 * The entire co-branding mechanism: overrides the --brand-* CSS custom
 * properties (defined with NTITT defaults in globals.css) for a given
 * company. Every component reading --brand-* rather than a hardcoded color
 * automatically reflects the tenant's branding -- content and layout stay
 * identical across every client, only these tokens change.
 *
 * `company` is null on the default (non-branded) app -- in that case this
 * renders nothing extra and the globals.css defaults apply untouched.
 */
export function ThemeProvider({
  company,
  children,
}: {
  company: Company | null;
  children: React.ReactNode;
}) {
  if (!company) {
    return <>{children}</>;
  }

  // display:contents so this wrapper carries the --brand-* overrides (custom
  // properties still inherit through it) without generating a layout box of its
  // own. That keeps the branded case identical to the unbranded one above (a
  // bare fragment): children lay out as direct participants of <body> rather
  // than inside an extra plain <div>. That extra div was a block with no
  // height, so it broke the flex/height chain from <body> to the (app) shell --
  // which is exactly why a short authenticated page left a white strip below
  // its dark surface on branded tenants. A styling-only div has no semantics,
  // so removing its box has no accessibility impact.
  const overrides: CSSProperties = {
    display: "contents",
    ...(company.primary_color ? { "--brand-primary": company.primary_color } : {}),
    ...(company.accent_color ? { "--brand-accent": company.accent_color } : {}),
  } as CSSProperties;

  return <div style={overrides}>{children}</div>;
}
