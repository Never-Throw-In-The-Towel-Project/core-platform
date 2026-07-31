import type { MetadataRoute } from "next";

// PWA-first per the agreed build order (Spec 3's website-first speed, with
// v3.1's native-app-shaped UX -- installable, push-capable). Icons are
// generated from the real NTITT logomark (NTITT Logos/NTITT-LOGOMARK-OUTLINE-TRANS.png),
// composited onto the app's #0a0a0a background -- see public/icon-*.png and
// src/app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Never Throw In The Towel",
    short_name: "NTITT",
    description: "Keep on Living. Daily wellbeing check-ins, community, and support.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
