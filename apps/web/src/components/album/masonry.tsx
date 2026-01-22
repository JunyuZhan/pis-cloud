'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Heart, Download, Share2, Expand, Loader2 } from 'lucide-react'
import type { Photo, Album } from '@/types/database'
import { cn } from '@/lib/utils'
import { PhotoLightbox } from './lightbox'
import { LayoutMode } from './layout-toggle'

interface MasonryGridProps {
  photos: Photo[]
  album: Album
  layout?: LayoutMode
  hasMore?: boolean
  isLoading?: boolean
  onLoadMore?: () => void
  onSelectChange?: (photoId: string, isSelected: boolean) => void
}

/**
 * 瀑布流照片网格
 * 支持：懒加载、Lightbox、选片功能、无限滚动、布局切换
 */
export function MasonryGrid({
  photos,
  album,
  layout = 'masonry',
  hasMore = false,
  isLoading = false,
  onLoadMore,
  onSelectChange,
}: MasonryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    photos.forEach((p) => {
      map[p.id] = p.is_selected
    })
    return map
  })

  // 无限滚动观察器
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  // 同步新照片的选中状态
  useEffect(() => {
    setSelectedMap((prev) => {
      const map = { ...prev }
      photos.forEach((p) => {
        if (!(p.id in map)) {
          map[p.id] = p.is_selected
        }
      })
      return map
    })
  }, [photos])

  const handlePhotoClick = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const handleCardSelect = useCallback(
    async (photoId: string, currentSelected: boolean) => {
      const newSelected = !currentSelected
      setSelectedMap((prev) => ({ ...prev, [photoId]: newSelected }))
      onSelectChange?.(photoId, newSelected)

      try {
        const res = await fetch(`/api/public/photos/${photoId}/select`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSelected: newSelected }),
        })

        if (!res.ok) {
          // 回滚
          setSelectedMap((prev) => ({ ...prev, [photoId]: currentSelected }))
          onSelectChange?.(photoId, currentSelected)
        }
      } catch (error) {
        // 回滚
        setSelectedMap((prev) => ({ ...prev, [photoId]: currentSelected }))
        onSelectChange?.(photoId, currentSelected)
      }
    },
    [onSelectChange]
  )

  // Lightbox 内选片变化时同步到本地状态
  const handleLightboxSelectChange = useCallback(
    (photoId: string, isSelected: boolean) => {
      setSelectedMap((prev) => ({ ...prev, [photoId]: isSelected }))
      onSelectChange?.(photoId, isSelected)
    },
    [onSelectChange]
  )

  return (
    <>
      <div
        className={cn(
          'gap-4 space-y-4',
          layout === 'masonry'
            ? 'columns-2 md:columns-3 lg:columns-4'
            : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 space-y-0'
        )}
      >
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            onClick={() => handlePhotoClick(index)}
            showSelect={true}
            isSelected={selectedMap[photo.id] || false}
            onSelect={(e) => {
              e.stopPropagation()
              handleCardSelect(photo.id, selectedMap[photo.id] || false)
            }}
            allowDownload={album.allow_download}
            layout={layout}
          />
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      <div ref={loadMoreRef} className="h-4" />

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex !== null ? lightboxIndex : -1}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        allowDownload={album.allow_download}
        onSelectChange={handleLightboxSelectChange}
      />
    </>
  )
}

interface PhotoCardProps {
  photo: Photo
  index: number
  onClick: () => void
  showSelect?: boolean
  isSelected?: boolean
  onSelect?: (e: React.MouseEvent) => void
  allowDownload?: boolean
  layout?: LayoutMode
}

function PhotoCard({
  photo,
  index,
  onClick,
  showSelect,
  isSelected,
  onSelect,
  allowDownload = false,
  layout = 'masonry',
}: PhotoCardProps) {
  const [showCopied, setShowCopied] = useState(false)
  
  // 计算图片高度比例 (Masonry 模式使用)
  const aspectRatio =
    photo.width && photo.height ? photo.height / photo.width : 1

  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  // 下载照片
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!allowDownload) return
    
    try {
      const response = await fetch(`/api/public/download/${photo.id}`)
      if (response.ok) {
        const data = await response.json()
        window.open(data.url, '_blank')
      }
    } catch (error) {
      console.error('下载失败:', error)
    }
  }

  // 分享照片
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = window.location.href
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '分享照片',
          url: shareUrl,
        })
      } catch (err) {
        // 用户取消分享
      }
    } else {
      // 复制链接
      await navigator.clipboard.writeText(shareUrl)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index % 10) * 0.05 }}
      className={cn(
        'group',
        layout === 'masonry' ? 'break-inside-avoid mb-4' : ''
      )}
    >
      {/* 照片卡片 */}
      <div className="bg-surface-elevated rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300">
        {/* 图片区域 */}
        <div 
          className={cn(
            "relative w-full overflow-hidden cursor-pointer",
            layout === 'grid' ? 'aspect-square' : ''
          )}
          onClick={onClick}
        >
          {photo.thumb_key ? (
            <Image
              src={`${mediaUrl}/${photo.thumb_key}`}
              alt={photo.filename}
              width={400}
              height={Math.round(400 * aspectRatio)}
              className={cn(
                "w-full transition-transform duration-500 group-hover:scale-105",
                layout === 'grid' ? "h-full object-cover" : "h-auto"
              )}
              loading="lazy"
            />
          ) : (
            <div
              className="w-full bg-surface"
              style={{ paddingBottom: layout === 'grid' ? '100%' : `${aspectRatio * 100}%` }}
            />
          )}

          {/* 悬停遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* 放大图标 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Expand className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* 照片序号 */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-md text-xs text-white font-medium">
            #{index + 1}
          </div>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={onSelect}
              className="p-3 hover:scale-110 transition-transform active:scale-90" // 增加点击热区
            >
              <Heart
                className={cn(
                  'w-6 h-6 drop-shadow-lg filter', // 略微放大图标
                  isSelected ? 'fill-red-500 text-red-500' : 'text-white'
                )}
              />
            </button>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-3 py-2.5 flex items-center justify-between border-t border-border/50">
          {/* 左侧：选片按钮 */}
          {showSelect && (
            <button
              onClick={onSelect}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                isSelected
                  ? 'bg-accent text-white'
                  : 'bg-surface hover:bg-accent/10 text-text-secondary hover:text-accent'
              )}
            >
              <Heart className={cn('w-4 h-4', isSelected && 'fill-current')} />
              <span>{isSelected ? '已选' : '选片'}</span>
            </button>
          )}

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1">
            {/* 下载按钮 */}
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-full hover:bg-surface text-text-muted hover:text-accent transition-colors"
                title="下载原图"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            
            {/* 分享按钮 */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-surface text-text-muted hover:text-accent transition-colors"
                title="分享"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {showCopied && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-elevated text-xs rounded shadow-lg whitespace-nowrap">
                  已复制链接
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
