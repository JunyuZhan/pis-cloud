import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // 生成唯一的构建 ID，用于缓存破坏
  generateBuildId: async () => {
    // 使用时间戳或 Git commit SHA（Vercel 会自动设置）
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'media.example.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.example.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
    // 图片优化配置
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Next.js 16+ 要求：配置允许的 quality 值
    // 确保包含项目中使用的所有 quality 值 (如 85)
    qualities: [75, 85, 100],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // 安全头配置
  async headers() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
    
    return [
      {
        // 应用到所有 API 路由
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: appUrl, // 限制为你的域名，不要使用 '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // 应用到所有页面
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // 静态资源缓存优化
        // 注意：icon.svg 使用较短的缓存时间，方便更新 logo
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: process.env.NODE_ENV === 'production' 
              ? 'public, max-age=86400, must-revalidate' // 生产环境：1天，允许重新验证
              : 'public, max-age=0, must-revalidate', // 开发环境：不缓存，确保更新立即生效
          },
        ],
      },
      {
        // 图片资源缓存优化
        source: '/processed/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)


