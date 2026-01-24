import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // 生成唯一的构建 ID，用于缓存破坏
  generateBuildId: async () => {
    // 使用时间戳或 Git commit SHA（Vercel 会自动设置）
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`
  },
  // 压缩配置（Next.js 15 默认启用）
  compress: true,
  // 优化生产构建
  productionBrowserSourceMaps: false, // 生产环境不生成 source maps，减少构建时间
  // 优化图片加载
  images: {
    remotePatterns: [
      // 本地开发环境
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // 生产环境媒体服务器（从环境变量动态获取）
      ...(process.env.NEXT_PUBLIC_MEDIA_URL
        ? (() => {
            try {
              const mediaUrl = new URL(process.env.NEXT_PUBLIC_MEDIA_URL)
              return [
                {
                  protocol: mediaUrl.protocol.replace(':', '') as 'http' | 'https',
                  hostname: mediaUrl.hostname,
                  pathname: '/**',
                },
              ]
            } catch {
              return []
            }
          })()
        : []),
      // 示例域名（向后兼容）
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
      // 常见媒体服务器域名（生产环境）
      {
        protocol: 'https',
        hostname: 'media.albertzhan.top',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'media.albertzhan.top',
        pathname: '/**',
      },
    ],
    // 图片优化配置
    formats: ['image/avif', 'image/webp'], // AVIF 优先（体积最小），WebP 作为后备
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 图片缓存 1 年（图片内容不变）
    // Next.js 16+ 要求：配置允许的 quality 值
    // 确保包含项目中使用的所有 quality 值
    qualities: [60, 75, 85, 100], // 添加 60 用于低质量占位符
    // 优化图片加载
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
      {
        // JavaScript 和 CSS 文件缓存优化
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 字体文件缓存优化
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  // Webpack 优化配置
  webpack: (config, { isServer }) => {
    // 生产环境优化
    if (!isServer && process.env.NODE_ENV === 'production') {
      // 优化代码分割
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // 框架代码单独打包
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // 第三方库单独打包
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module: { context: string }) {
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1]
                return packageName ? `npm.${packageName.replace('@', '')}` : 'lib'
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // 公共代码
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            // 共享代码
            shared: {
              name: 'shared',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }
    return config
  },
}

export default withNextIntl(nextConfig)


