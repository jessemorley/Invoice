import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.54', '10.0.0.15', '10.0.0.16'],
  cacheComponents: true,
};

export default nextConfig;
