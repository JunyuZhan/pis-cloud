'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Heart, Download, Share2, Expand, Loader2, ImageIcon } from 'lucide-react'
import type { Photo, Album } from '@/types/database'
import { cn } from '@/lib/utils'
import { getBlurDataURL } from '@/lib/blurhash'
import { handleApiError } from '@/lib/toast'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { LayoutMode } from './layout-toggle'

// 动态导入 Lightbox 组件（按需加载，减少初始 bundle）
const PhotoLightbox = dynamic(() => import('./lightbox').then(mod => ({ default: mod.PhotoLightbox })), {
  ssr: false,
  loading: () => null, // Lightbox 打开时才显示，不需要加载状态
})

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
  const photoRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastViewedIndexRef = useRef<number | null>(null)

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
      const newMap = { ...prev }
      let hasChanges = false
      photos.forEach((p) => {
        if (!(p.id in newMap)) {
          newMap[p.id] = p.is_selected
          hasChanges = true
        }
      })
      return hasChanges ? newMap : prev
    })
  }, [photos])

  const handlePhotoClick = useCallback((index: number) => {
    lastViewedIndexRef.current = index
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

  const handleLightboxIndexChange = useCallback((newIndex: number) => {
    lastViewedIndexRef.current = newIndex
  }, [])

  const scrollToPhotoIndex = useCallback((targetIndex: number | null) => {
    if (targetIndex === null) return
    const target = photoRefs.current[targetIndex]
    if (!target) return
    const rect = target.getBoundingClientRect()
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
    if (!inView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleLightboxClose = useCallback(() => {
    const targetIndex = lastViewedIndexRef.current ?? lightboxIndex
    setLightboxIndex(null)
    if (targetIndex !== null && targetIndex !== undefined) {
      requestAnimationFrame(() => scrollToPhotoIndex(targetIndex))
    }
  }, [lightboxIndex, scrollToPhotoIndex])

  return (
    <>
      <div
        className={cn(
          layout === 'masonry'
            ? 'columns-2 sm:columns-3 md:columns-3 lg:columns-4' // 响应式列数
            : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1' // 响应式网格，间距 4px
        )}
        style={layout === 'masonry' ? { columnGap: '0.25rem' } : undefined} // 列间距 4px，与垂直间距一致
      >
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            cardRef={(node) => {
              photoRefs.current[index] = node
            }}
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

      {/* Lightbox - 只在有照片且索引有效时渲染 */}
      {lightboxIndex !== null && 
       lightboxIndex >= 0 && 
       lightboxIndex < photos.length && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          open={true}
          onClose={handleLightboxClose}
          allowDownload={album.allow_download}
          onSelectChange={handleLightboxSelectChange}
          onIndexChange={handleLightboxIndexChange}
        />
      )}
    </>
  )
}

interface PhotoCardProps {
  photo: Photo
  index: number
  onClick: () => void
  cardRef?: React.Ref<HTMLDivElement>
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
  cardRef,
  showSelect,
  isSelected,
  onSelect,
  allowDownload = false,
  layout = 'masonry',
}: PhotoCardProps) {
  const [showCopied, setShowCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [blurDataURL, setBlurDataURL] = useState<string | undefined>(undefined)
  
  // 计算图片高度比例 (Masonry 模式使用)
  const aspectRatio =
    photo.width && photo.height ? photo.height / photo.width : 1

  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
  
  // 使用配置的 URL，不强制转换协议（开发环境可能使用 HTTP）
  const safeMediaUrl = mediaUrl

  // 前 6 张图片优先加载（首屏可见区域）
  // 其他图片通过 Intersection Observer 在进入视口时加载
  const isPriority = index < 6

  // 在客户端生成 BlurHash data URL
  useEffect(() => {
    if (photo.blur_data && typeof window !== 'undefined') {
      const dataURL = getBlurDataURL(photo.blur_data)
      if (dataURL) {
        setBlurDataURL(dataURL)
      }
    }
  }, [photo.blur_data])

  // 下载照片
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!allowDownload) return
    
    try {
      const response = await fetch(`/api/public/download/${photo.id}`)
      if (!response.ok) {
        const error = await response.json()
        handleApiError(new Error(error.error?.message || '下载失败'))
        return
      }

      const { downloadUrl, filename } = await response.json()

      // 触发下载
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('下载失败:', error)
      handleApiError(error, '下载失败，请重试')
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
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index % 10) * 0.05 }}
      className={cn(
        'group relative',
        layout === 'masonry' ? 'break-inside-avoid mb-1' : '' // 添加底部间距 4px，与列间距保持一致
      )}
    >
      {/* 照片卡片 - 移除圆角和阴影，实现无缝效果 */}
      <div className="bg-surface-elevated overflow-hidden">
        {/* 图片区域 */}
        <div 
          className={cn(
            "relative w-full overflow-hidden cursor-pointer touch-manipulation",
            layout === 'grid' ? 'aspect-square' : ''
          )}
          onClick={onClick}
        >
          {photo.thumb_key ? (
            <OptimizedImage
              src={`${safeMediaUrl.replace(/\/$/, '')}/${photo.thumb_key.replace(/^\//, '')}?r=${photo.rotation ?? 'auto'}&t=${photo.updated_at ? new Date(photo.updated_at).getTime() : Date.now()}`}
              alt={photo.filename || 'Photo'}
              width={layout === 'grid' ? undefined : 400}
              height={layout === 'grid' ? undefined : Math.round(400 * aspectRatio)}
              fill={layout === 'grid'}
              className={cn(
                "w-full transition-transform duration-500 group-hover:scale-105",
                layout === 'grid' ? "h-full object-cover" : "h-auto"
              )}
              quality={isPriority ? 85 : 75} // 优先图片质量高，其他降低质量
              sizes={layout === 'grid' 
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
              priority={isPriority}
              blurDataURL={blurDataURL}
              aspectRatio={layout !== 'grid' ? aspectRatio : undefined}
              onError={() => setImageError(true)}
              unoptimized // 缩略图已优化(400px)，跳过 Vercel 处理，直接从 Cloudflare CDN 加载
            />
          ) : (
            <div
              className={cn(
                "w-full flex items-center justify-center bg-surface-elevated",
                layout === 'grid' ? 'aspect-square' : ''
              )}
              style={layout !== 'grid' ? { paddingBottom: `${aspectRatio * 100}%` } : undefined}
            >
              <ImageIcon className="w-8 h-8 text-text-muted" />
            </div>
          )}

          {/* 悬停遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* 放大图标 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Expand className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* 底部操作栏 - 悬浮在图片上 */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            {/* 左侧：选片按钮 */}
            {showSelect && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect && onSelect(e)
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-md',
                  isSelected
                    ? 'bg-red-500/90 text-white hover:bg-red-600/90'
                    : 'bg-black/40 text-white hover:bg-black/60'
                )}
              >
                <Heart className={cn('w-4 h-4', isSelected && 'fill-current')} />
                <span>{isSelected ? '已选' : '选片'}</span>
              </button>
            )}

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2">
              {/* 下载按钮 */}
              {allowDownload && (
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
                  title="下载原图"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              
              {/* 分享按钮 */}
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
                  title="分享"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {showCopied && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded shadow-lg whitespace-nowrap backdrop-blur-md">
                    已复制链接
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 始终显示的选中状态（右上角红心） */}
          {isSelected && (
            <div className="absolute top-2 right-2 z-10">
              <div className="p-2 bg-red-500/90 rounded-full shadow-lg backdrop-blur-sm">
                <Heart className="w-4 h-4 text-white fill-current" />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
