'use client'

import { Camera } from 'lucide-react'
import { AlbumShareButton } from './album-share-button'
import type { Album } from '@/types/database'

interface AlbumInfoBarProps {
  album: Album
  backgroundImageUrl?: string | null
}

export function AlbumInfoBar({ album, backgroundImageUrl }: AlbumInfoBarProps) {
  return (
    <div className="bg-surface-elevated border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-5">
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：摄影师信息 */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* 摄影师头像/Logo */}
            <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-full overflow-hidden bg-surface border-2 border-accent/30 shrink-0">
              {/* 可以替换为真实的摄影师头像 */}
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                <Camera className="w-5 h-5 md:w-6 md:h-6 text-accent" />
              </div>
            </div>

            <div>
              <p className="text-xs md:text-sm text-text-muted">摄影师</p>
              <p className="font-medium text-sm md:text-base text-text-primary">
                {process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'}
              </p>
              <p className="text-xs text-text-muted mt-0.5 hidden md:block">
                {process.env.NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE || '专业活动摄影'}
              </p>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center shrink-0">
            <AlbumShareButton 
              albumSlug={album.slug} 
              albumTitle={album.title}
              albumDescription={album.description}
              backgroundImageUrl={backgroundImageUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
