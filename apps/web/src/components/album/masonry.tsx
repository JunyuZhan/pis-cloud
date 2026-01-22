'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Heart, Loader2 } from 'lucide-react'
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
  layout?: LayoutMode
}

function PhotoCard({
  photo,
  index,
  onClick,
  showSelect,
  isSelected,
  onSelect,
  layout = 'masonry',
}: PhotoCardProps) {
  // 计算图片高度比例 (Masonry 模式使用)
  const aspectRatio =
    photo.width && photo.height ? photo.height / photo.width : 1

  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index % 10) * 0.05 }}
      className={cn(
        'group relative cursor-pointer',
        layout === 'masonry' ? 'break-inside-avoid mb-4' : 'aspect-square'
      )}
      onClick={onClick}
    >
      <div className="relative w-full h-full overflow-hidden rounded-lg bg-surface">
        {/* 图片 */}
        {photo.thumb_key ? (
          <Image
            src={`${mediaUrl}/${photo.thumb_key}`}
            alt={photo.filename}
            width={400}
            height={Math.round(400 * aspectRatio)}
            className={cn(
              "w-full h-full transition-transform duration-300 group-hover:scale-105",
              layout === 'grid' ? "object-cover" : "h-auto"
            )}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full bg-surface-elevated"
            style={{ paddingBottom: `${aspectRatio * 100}%` }}
          />
        )}

        {/* 遮罩层 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* 选片按钮 */}
        {showSelect && (
          <button
            onClick={onSelect}
            className={cn(
              'absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition-all duration-300',
              isSelected
                ? 'bg-accent text-white shadow-lg scale-100 opacity-100'
                : 'bg-black/30 text-white/70 hover:bg-black/50 opacity-0 group-hover:opacity-100 hover:scale-110'
            )}
          >
            {isSelected ? (
              <Heart className="w-4 h-4 fill-current" />
            ) : (
              <Heart className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}
