'use client'

import { Camera, Heart } from 'lucide-react'
import type { Album } from '@/types/database'

interface AlbumFooterProps {
  album: Album
}

export function AlbumFooter({ album }: AlbumFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-surface border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* 上部分：品牌信息 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-border/50">
          {/* 品牌 Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-serif font-bold text-lg">PIS</p>
              <p className="text-xs text-text-muted">私有化即时摄影分享系统</p>
            </div>
          </div>

          {/* 感谢语 */}
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <span>感谢选择我们的摄影服务</span>
            <Heart className="w-4 h-4 text-red-400 fill-current" />
          </div>
        </div>

        {/* 下部分：版权信息 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6 text-text-muted text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span>© {currentYear} PIS Photography. All rights reserved.</span>
            <span className="hidden md:inline">|</span>
            <a href="#" className="hover:text-accent transition-colors">隐私政策</a>
            <a href="#" className="hover:text-accent transition-colors">使用条款</a>
          </div>

          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <a 
              href="https://github.com/JunyuZhan/PIS" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              PIS
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
