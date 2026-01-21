import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedRoutes: false },
  trailingSlash: true,
  output: "export",
};

export default nextConfig;
