'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Camera, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlbumShareButton } from './album-share-button'
import type { Album } from '@/types/database'

interface AlbumInfoBarProps {
  album: Album
}

export function AlbumInfoBar({ album }: AlbumInfoBarProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  
  // 判断描述是否需要折叠
  const shouldTruncate = album.description && album.description.length > 100

  return (
    <div className="bg-surface-elevated border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* 左侧：摄影师信息 */}
          <div className="flex items-center gap-4">
            {/* 摄影师头像/Logo */}
            <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-surface border-2 border-accent/30 shrink-0">
              {/* 可以替换为真实的摄影师头像 */}
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                <Camera className="w-6 h-6 md:w-7 md:h-7 text-accent" />
              </div>
            </div>

            <div>
              <p className="text-sm text-text-muted">摄影师</p>
              <p className="font-medium text-text-primary">PIS Photography</p>
              <p className="text-xs text-text-muted mt-0.5">专业活动摄影</p>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2">
            {album.allow_download && (
              <button className="btn-secondary text-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">下载全部</span>
              </button>
            )}
            <AlbumShareButton albumSlug={album.slug} albumTitle={album.title} />
          </div>
        </div>

        {/* 活动介绍折叠面板 */}
        {album.description && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full text-left"
            >
              <span className="font-medium">活动介绍</span>
              {shouldTruncate && (
                isDescExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )
              )}
            </button>

            <AnimatePresence>
              <motion.div
                initial={false}
                animate={{ 
                  height: isDescExpanded || !shouldTruncate ? 'auto' : '48px',
                  opacity: 1 
                }}
                className="overflow-hidden"
              >
                <p className={`text-text-secondary text-sm mt-2 leading-relaxed ${
                  !isDescExpanded && shouldTruncate ? 'line-clamp-2' : ''
                }`}>
                  {album.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
