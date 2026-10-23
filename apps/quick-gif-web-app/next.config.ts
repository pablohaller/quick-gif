import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship as TS/TSX source; Next compiles them.
  transpilePackages: ["@quick-gif/core", "@quick-gif/ui"],
  experimental: {
    agentUpgrade: "security",
  },
  // Classic dynamic rendering: these pages read the local filesystem on each request.
  cacheComponents: false,
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
