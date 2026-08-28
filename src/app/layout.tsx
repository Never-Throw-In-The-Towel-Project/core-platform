import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { headers } from "next/headers";
import "./globals.css";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

// Self-hosted (was next/font/google) so the Turbopack build never fetches from
// fonts.gstatic.com -- that fetch flaked intermittently in CI ("Can't resolve
// @vercel/turbopack-next/internal/font/google/font"). Same typefaces: Archivo
// variable (its weight axis covers the 400/600/800 we use) bundled in the repo,
// and Geist Mono from the official `geist` package. Variable names are
// unchanged (--font-archivo / --font-geist-mono), so globals.css is untouched.
const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

// Canonical public origin for absolute URLs in metadata (Open Graph, sitemap,
// robots). Falls back to the production domain so a share preview never resolves
// against a bare relative path when the env var is unset.
const SITE_ORIGIN = `https://${process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "neverthrowinthetowel.uk"}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Never Throw In The Towel",
    template: "%s · Never Throw In The Towel",
  },
  description: "Keep on Living.",
  applicationName: "Never Throw In The Towel",
  openGraph: {
    title: "Never Throw In The Towel",
    description: "Keep on Living.",
    siteName: "Never Throw In The Towel",
    type: "website",
    locale: "en_GB",
    url: SITE_ORIGIN,
  },
  twitter: {
    card: "summary_large_image",
    title: "Never Throw In The Towel",
    description: "Keep on Living.",
  },
};

// `viewport-fit=cover` lets the page draw under the notch / home indicator and,
// crucially, makes `env(safe-area-inset-*)` resolve to real values instead of 0
// -- without it the safe-area padding on the sticky bottom nav and the support
// modal would be no-ops. `width=device-width, initial-scale=1` is Next.js's
// default; we set it here alongside so the whole viewport policy lives in one place.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const company = await resolveCompanyForHost(host);

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider company={company}>{children}</ThemeProvider>
        {/*
         * "Ask for Support" is rendered in the (app) and (admin) layouts,
         * not here -- it needs an authenticated user's own company_id to
         * route to the right support contact (the hostname-resolved
         * `company` above is only for pre-auth branding, e.g. the login
         * page's logo/colors, and isn't necessarily the user's employer on
         * the default app.neverthrowinthetowel.uk domain). See docs/ARCHITECTURE.md.
         */}
      </body>
    </html>
  );
}
