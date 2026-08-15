import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. Community post photo uploads (submitCommunityPost)
      // go through this same server-action body limit -- see
      // src/lib/community/imageUpload.ts for the actual file-size cap
      // (5MB) enforced on the file itself; this just needs enough room for
      // that plus multipart/form-data overhead.
      bodySizeLimit: "6mb",
    },
  },
  // The NTITT admin tools moved out of the member app (/community/admin/*,
  // /admin/invite) into the dedicated /admin Control Tower (see
  // docs/PLATFORM_STRUCTURE.md). Permanent redirects keep old links working.
  async redirects() {
    return [
      { source: "/community/admin", destination: "/admin/moderation", permanent: true },
      { source: "/community/admin/content", destination: "/admin/content", permanent: true },
      { source: "/community/admin/challenges", destination: "/admin/challenges", permanent: true },
      { source: "/community/admin/challenges/:id", destination: "/admin/challenges/:id", permanent: true },
      { source: "/community/admin/podcast-guests", destination: "/admin/podcast", permanent: true },
      { source: "/admin/invite", destination: "/admin/companies", permanent: true },
      // The HR dashboard moved into the "{Company} Workspace" site.
      { source: "/dashboard", destination: "/workspace", permanent: true },
      // The company step-challenge screen: singular /challenge collided with the
      // multi-day programmes at /challenges (a one-letter difference). Renamed to
      // /step-challenge; old links keep working.
      { source: "/challenge", destination: "/step-challenge", permanent: true },
    ];
  },
};

export default nextConfig;
