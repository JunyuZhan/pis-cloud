'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'

export function HomeHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-3 md:py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          {/* Logo - 使用img避免hydration问题 */}
          <img
            src="/icons/icon.svg"
            alt="PIS Logo"
            className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 transition-transform group-hover:scale-110"
          />
          {/* 品牌名称和说明 */}
          <div className="flex flex-col">
            <span className="text-lg md:text-xl font-serif font-bold leading-tight">PIS</span>
            <span className="text-xs text-text-muted leading-tight hidden sm:block">
              私有化即时摄影分享系统
            </span>
          </div>
        </Link>
        <Link 
          href="/admin" 
          className="flex items-center justify-center w-8 h-8 text-text-muted hover:text-text-secondary transition-colors cursor-pointer group rounded-md hover:bg-surface"
          prefetch={false}
          title="管理后台"
        >
          <Settings className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </header>
  )
}
