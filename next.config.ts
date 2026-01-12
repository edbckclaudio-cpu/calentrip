import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  experimental: { typedRoutes: false },
};

export default nextConfig;
