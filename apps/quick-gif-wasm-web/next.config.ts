import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship as TS/TSX source; Next compiles them.
  transpilePackages: ["@quick-gif/core", "@quick-gif/ui"],
  experimental: {
    agentUpgrade: "security",
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
