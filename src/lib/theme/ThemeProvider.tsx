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

  const overrides: CSSProperties = {
    ...(company.primary_color ? { "--brand-primary": company.primary_color } : {}),
    ...(company.accent_color ? { "--brand-accent": company.accent_color } : {}),
  } as CSSProperties;

  return <div style={overrides}>{children}</div>;
}
