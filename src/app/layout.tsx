import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { resolveCompanyForHost } from "@/lib/tenant/resolve";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const archivo = Archivo({
  variable: "--font-archivo",
  weight: ["400", "600", "800"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Canonical public origin for absolute URLs in metadata (Open Graph, sitemap,
// robots). Falls back to the production domain so a share preview never resolves
// against a bare relative path when the env var is unset.
const SITE_ORIGIN = `https://${process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "ntitt.co.uk"}`;

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
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider company={company}>{children}</ThemeProvider>
        {/*
         * "Ask for Support" is rendered in the (app) and (admin) layouts,
         * not here -- it needs an authenticated user's own company_id to
         * route to the right support contact (the hostname-resolved
         * `company` above is only for pre-auth branding, e.g. the login
         * page's logo/colors, and isn't necessarily the user's employer on
         * the default app.ntitt.co.uk domain). See docs/ARCHITECTURE.md.
         */}
      </body>
    </html>
  );
}
