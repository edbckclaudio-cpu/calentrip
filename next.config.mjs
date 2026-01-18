/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  trailingSlash: true,
  output: 'export',
  basePath: '',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "via.placeholder.com" },
    ],
  },
};

export default nextConfig;
