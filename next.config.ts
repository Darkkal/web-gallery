import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Generate a self-contained standalone server bundle for Docker.
  // This traces all required dependencies at build time and avoids
  // Turbopack's runtime external module resolution issues with native packages
  // like @libsql/client.
  output: "standalone",
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingExcludes: {
    "*": [
      "./dist/**/*",
      "./scratch/**/*",
      "./tests/**/*",
      "./playwright.config.ts",
      "./test-results/**/*",
      "./test-data/**/*",
      "./test-media/**/*",
      "./sqlite.db",
      "./.env",
    ],
  },
  images: {
    // Wildcard patterns needed for scraper-sourced content from arbitrary domains.
    // Local paths (e.g. /downloads/...) are served directly and don't require these,
    // but they ensure any external URLs stored in the DB still work with next/image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
