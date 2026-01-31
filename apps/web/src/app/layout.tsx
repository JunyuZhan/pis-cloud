/**
 * PIS Web Application - Root Layout
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Serif_SC, Playfair_Display } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Providers } from '@/components/providers'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { SiteFooter } from '@/components/site-footer'

// 优化字体加载 - 使用 next/font 自动优化
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
})

const notoSerifSC = Noto_Serif_SC({ 
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false, // 按需加载
  variable: '--font-noto-serif-sc',
})

const playfairDisplay = Playfair_Display({ 
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false, // 按需加载
  variable: '--font-playfair-display',
})

// Metadata will be generated dynamically based on locale
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  // Messages are loaded but not used in metadata (only used in layout)
  await getMessages()
  
  // Get translations for metadata
  const title = locale === 'zh-CN' 
    ? 'PIS - 专业级摄影分享'
    : 'PIS - Professional Photo Sharing'
  const description = locale === 'zh-CN'
    ? '私有化即时摄影分享系统，让每一刻精彩即时呈现'
    : 'Private Instant photo Sharing system'
  
  return {
    title,
    description,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'PIS',
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: 'website',
      siteName: 'PIS',
      title,
      description,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#D4AF37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const messages = await getMessages()
  
  // 获取媒体服务器域名用于预连接
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
  const mediaHost = mediaUrl ? new URL(mediaUrl).origin : null
  
  return (
    <html lang={locale} className={`dark ${inter.variable} ${notoSerifSC.variable} ${playfairDisplay.variable}`} data-scroll-behavior="smooth">
      <head>
        {/* 性能优化：DNS 预解析和预连接 */}
        {mediaHost && (
          <>
            <link rel="dns-prefetch" href={mediaHost} />
            <link rel="preconnect" href={mediaHost} crossOrigin="anonymous" />
          </>
        )}
        {/* 预连接 Google Fonts（next/font 会自动处理，但添加以优化） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* PWA Apple 特定 meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PIS" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192x192.png" />
        {/* Splash screens for iOS */}
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1284x2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {children}
            <SiteFooter />
            <PWAInstallPrompt />
          </Providers>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
