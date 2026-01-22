'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SortToggle, type SortRule } from './sort-toggle'
import { LayoutToggle, type LayoutMode } from './layout-toggle'
import type { Album } from '@/types/database'

interface AlbumHeaderProps {
  album: Album
  currentSort: SortRule
  currentLayout: LayoutMode
}

export function AlbumHeader({ album, currentSort, currentLayout }: AlbumHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 简单的字符数判断来决定是否需要展开功能
  // 实际项目中可以更精确地计算高度
  const shouldTruncate = album.description && album.description.length > 60

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-serif font-bold truncate">
                {album.title}
              </h1>
              
              {/* 桌面端描述 (完整显示) */}
              {album.description && (
                <p className="hidden md:block text-text-secondary text-sm mt-1 max-w-2xl">
                  {album.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <span className="text-text-secondary text-xs md:text-sm whitespace-nowrap hidden sm:inline">
                {album.photo_count} 张
              </span>
              <LayoutToggle currentLayout={currentLayout} />
              <SortToggle currentSort={currentSort} />
            </div>
          </div>

          {/* 移动端描述 (支持展开) */}
          {album.description && (
            <div className="md:hidden">
              <p className={`text-text-secondary text-xs transition-all duration-300 ${
                isExpanded ? '' : 'line-clamp-2'
              }`}>
                {album.description}
              </p>
              {shouldTruncate && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-accent mt-1 hover:text-accent-hover transition-colors"
                >
                  {isExpanded ? (
                    <>
                      收起 <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      展开更多 <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
