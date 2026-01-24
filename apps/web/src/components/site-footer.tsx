'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function SiteFooter() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-text-muted">
          {/* 左侧：版权和链接 */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <span>© {currentYear} {process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'}. All rights reserved.</span>
            <span className="hidden md:inline">|</span>
            <span className="hover:text-accent transition-colors cursor-pointer">
              {t('privacyPolicy')}
            </span>
            <span className="hover:text-accent transition-colors cursor-pointer">
              {t('termsOfService')}
            </span>
          </div>

          {/* 右侧：Powered by */}
          <div className="flex items-center gap-1">
            <span>{t('poweredBy')}</span>
            <Link
              href="https://github.com/JunyuZhan/PIS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline transition-colors"
            >
              PIS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
