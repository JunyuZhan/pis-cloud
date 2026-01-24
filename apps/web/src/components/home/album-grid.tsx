'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { FolderOpen, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import type { Album } from '@/types/database'

interface AlbumGridProps {
  albums: Album[]
}

interface AlbumWithCover extends Album {
  cover_thumb_key?: string | null
  cover_preview_key?: string | null
}

function AlbumCard({ album, coverUrl, index }: { album: AlbumWithCover; coverUrl: string | null; index: number }) {
  const [imageError, setImageError] = useState(false)

  return (
    <motion.div
      key={album.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ 
        duration: 0.3, 
        delay: Math.min(index * 0.03, 0.2),
        ease: 'easeOut'
      }}
      className="break-inside-avoid mb-2 md:mb-3 group cursor-pointer touch-manipulation"
    >
      <Link href={`/album/${album.slug}?from=home`} className="block relative w-full overflow-hidden rounded-md bg-surface active:opacity-90 transition-opacity">
        {coverUrl && !imageError ? (
          <div className="relative w-full aspect-square overflow-hidden">
            <Image
              src={coverUrl}
              alt={album.title}
              fill
              className="object-cover transition-opacity duration-300 group-hover:opacity-90"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={true}
              onError={() => setImageError(true)}
            />
            {/* 极简hover效果 - 只显示标题 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-4 text-center line-clamp-2">
                {album.title}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-surface-elevated">
            <ImageIcon className="w-10 h-10 text-text-muted" />
          </div>
        )}
      </Link>
    </motion.div>
  )
}

export function AlbumGrid({ albums }: AlbumGridProps) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''

  // 确保 mediaUrl 使用 HTTPS（避免 Mixed Content）
  const safeMediaUrl = mediaUrl.startsWith('http://') 
    ? mediaUrl.replace('http://', 'https://')
    : mediaUrl

  return (
    <div className="w-full">
      {/* Instagram/Pinterest风格的无缝网格 */}
      <div className="columns-2 sm:columns-3 md:columns-4 gap-2 md:gap-3">
        {albums.map((album, index) => {
          const albumWithCover = album as AlbumWithCover
          // 使用封面照片的 key（优先 preview_key，其次 thumb_key）
          const coverKey = albumWithCover.cover_preview_key || albumWithCover.cover_thumb_key
          // 确保 coverKey 存在且不为空字符串
          const coverUrl = coverKey && coverKey.trim() 
            ? `${safeMediaUrl.replace(/\/$/, '')}/${coverKey.replace(/^\//, '')}` 
            : null

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
