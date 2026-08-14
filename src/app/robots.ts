import type { MetadataRoute } from "next";

// Same canonical origin as the layout metadata. The public marketing pages are
// crawlable; the authenticated app + API surfaces are not (they only ever
// redirect a crawler to /login anyway, but keep them out of the index explicitly).
const SITE_ORIGIN = `https://${process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "ntitt.co.uk"}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/home",
        "/onboarding",
        "/community",
        "/journey",
        "/content",
        "/challenge",
        "/challenges",
        "/reviews",
        "/settings",
        "/dashboard",
        "/workspace",
        "/admin",
        "/checkin",
        "/morning-routine",
        "/night-routine",
        "/sunday-setup",
        "/weekly-review",
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
