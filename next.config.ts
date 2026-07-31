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
};

export default nextConfig;
