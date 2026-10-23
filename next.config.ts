import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Cache profiles for the database reads (src/lib/data.ts).
  // On top of that, the sync invalidates the "data" tag when it finishes.
  cacheLife: {
    // Results, fixtures and standings: they change on match days.
    results: { stale: 60, revalidate: 300, expire: 86400 },
    // Teams, competitions and venues: they change a few times a week.
    catalog: { stale: 300, revalidate: 3600, expire: 604800 },
  },
  images: {
    // sharp is not built in this setup (pnpm allowBuilds); the league's images
    // already come in small sizes, so we do not optimize them.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "www.futbolempresas.es", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "live.staticflickr.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
