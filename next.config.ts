import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Cloudflare: skip sharp (native module, not supported on Workers)
  // Cloudflare has its own image optimization via Polish
  images: {
    unoptimized: true,
  },
  // External packages that should not be bundled (native modules)
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
