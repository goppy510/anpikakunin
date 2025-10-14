import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Production builds ignore ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Production builds ignore TypeScript errors for Docker deployment
    ignoreBuildErrors: true,
  },
  // External packages configuration
  serverExternalPackages: [],
  // Provide fallback env vars for build
  env: {
    NEXT_PUBLIC_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || "http://localhost:8080/oauth",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080",
  },
};

export default nextConfig;
