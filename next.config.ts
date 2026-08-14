import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Pin the workspace root to this project. A stray package.json/lock in the
  // parent home directory otherwise makes Turbopack infer C:\Users\roman as the
  // root, which mis-resolves modules (duplicate React, stale node_modules).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
