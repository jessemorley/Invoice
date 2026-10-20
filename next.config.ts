import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.54', '10.0.0.15', '10.0.0.16'],
  cacheComponents: true,
  // Names the service worker's caches (public/sw.js). "dev" disables its caching.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
};

export default nextConfig;
