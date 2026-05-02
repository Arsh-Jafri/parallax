import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  async rewrites() {
    return [
      // Proxy /api/backend/* → FastAPI (used when NEXT_PUBLIC_API_URL is set)
      {
        source: '/api/backend/:path*',
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
