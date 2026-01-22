import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'media.albertzhan.top',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.albertzhan.top',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
// trigger deploy Thu Jan 22 23:17:45 CST 2026
//junyuzhan g


