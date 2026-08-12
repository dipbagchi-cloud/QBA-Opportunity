import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build output directory, overridable per invocation.
  //
  // `next build` rewrites its output directory in place, deleting the previous
  // build's content-hashed assets. While that runs, the server still serving
  // the OLD build advertises asset URLs that no longer exist, so every
  // /_next/static/* request 404s and pages render unstyled for the duration of
  // the build (~3 minutes) — with the page itself still returning 200.
  //
  // Deploys therefore build into a scratch directory (NEXT_DIST_DIR=.next.build)
  // and swap it into place with a rename, cutting that window from minutes to
  // the restart itself. See scripts/build-and-swap.sh.
  //
  // Only ever set for the build command — `next start` must resolve `.next`,
  // so the variable must not be exported into the PM2 runtime environment.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Prevent caching of HTML pages so users always get latest chunk references
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
        has: [
          {
            type: "header",
            key: "accept",
            value: ".*text/html.*",
          },
        ],
      },
      {
        // Allow caching for static assets (they have content hashes)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
