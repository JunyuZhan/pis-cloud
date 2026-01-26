'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ImageIcon, Camera } from 'lucide-react'
import { useState } from 'react'
import type { Album } from '@/types/database'
import { OptimizedImage } from '@/components/ui/optimized-image'

interface AlbumGridProps {
  albums: Album[]
}

interface AlbumWithCover extends Album {
  cover_thumb_key?: string | null
  cover_preview_key?: string | null
}

function AlbumCard({ album, coverUrl, index }: { 
  album: AlbumWithCover
  coverUrl: string | null
  index: number
}) {
  const [imageError, setImageError] = useState(false)
  const isPriority = index < 6

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="group cursor-pointer"
    >
      <Link 
        href={`/album/${album.slug}?from=home`} 
        className="block relative w-full rounded-lg shadow-[0_0_15px_rgba(212,175,55,0.35)] hover:shadow-[0_0_25px_rgba(212,175,55,0.55)] transition-all duration-500"
      >
        {coverUrl && !imageError ? (
          <div className="relative w-full aspect-[4/5] overflow-hidden rounded-lg">
            {/* 照片 */}
            <OptimizedImage
              src={coverUrl}
              alt={album.title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              quality={isPriority ? 85 : 75}
              priority={isPriority}
              onError={() => setImageError(true)}
              unoptimized // 缩略图已优化，直接从 Cloudflare CDN 加载
            />
            
            {/* 优雅的渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            
            {/* 相册信息 - 底部展示 */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              {/* 相册标题 */}
              <h3 className="font-medium text-white text-base sm:text-lg drop-shadow-lg line-clamp-1">
                {album.title}
              </h3>
              
              {/* 照片数量 */}
              {album.photo_count > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 text-white/70">
                  <Camera className="w-3 h-3" />
                  <span className="text-xs font-light">
                    {album.photo_count} 张作品
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full aspect-[4/5] flex flex-col items-center justify-center bg-surface-elevated rounded-lg">
            <ImageIcon className="w-10 h-10 text-text-muted mb-2" />
            <span className="text-text-muted text-sm">{album.title}</span>
          </div>
        )}
      </Link>
    </motion.div>
  )
}

export function AlbumGrid({ albums }: AlbumGridProps) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''

  return (
    <div className="w-full">
      {/* 整齐的网格布局 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {albums.map((album, index) => {
          const albumWithCover = album as AlbumWithCover
          // 优先使用海报图片，否则使用封面照片
          const coverUrl = albumWithCover.poster_image_url && albumWithCover.poster_image_url.trim()
            ? albumWithCover.poster_image_url.trim()
            : (() => {
                const coverKey = albumWithCover.cover_preview_key || albumWithCover.cover_thumb_key
                return coverKey && coverKey.trim() 
                  ? `${mediaUrl.replace(/\/$/, '')}/${coverKey.replace(/^\//, '')}` 
                  : null
              })()

          return (
            <AlbumCard
              key={album.id}
              album={albumWithCover}
              coverUrl={coverUrl}
              index={index}
            />
          )
        })}
      </div>
    </div>
  )
}
