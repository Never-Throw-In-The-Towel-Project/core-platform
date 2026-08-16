import type { MetadataRoute } from "next";

// The public marketing routes (src/app/(marketing)). Kept as an explicit list —
// the app routes are auth-gated and deliberately excluded from the sitemap.
const SITE_ORIGIN = `https://${process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN || "neverthrowinthetowel.uk"}`;

const MARKETING_PATHS = [
  "",
  "/what-i-do",
  "/what-i-do/coaching",
  "/what-i-do/pop-up-barbershop",
  "/events",
  "/documentary",
  "/podcast",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
