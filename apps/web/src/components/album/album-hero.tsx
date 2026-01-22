'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Eye, Heart, Calendar, MapPin, Clock, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Album, Photo } from '@/types/database'

interface AlbumHeroProps {
  album: Album
  coverPhoto?: Photo | null
}

export function AlbumHero({ album, coverPhoto }: AlbumHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  // 获取封面图 URL
  const coverUrl = coverPhoto?.preview_key 
    ? `${mediaUrl}/${coverPhoto.preview_key}`
    : coverPhoto?.thumb_key 
      ? `${mediaUrl}/${coverPhoto.thumb_key}`
      : null

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // 格式化日期时间（用于活动时间）
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const eventDate = (album as any).event_date
  const location = (album as any).location

  // 模拟浏览量（后续可替换为真实数据）
  const viewCount = (album as any).view_count || Math.floor(Math.random() * 500) + 100
  const selectedCount = (album as any).selected_count || 0

  return (
    <div className="relative w-full h-[50vh] md:h-[60vh] lg:h-[70vh] min-h-[400px] overflow-hidden">
      {/* 背景图片 */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={album.title}
          fill
          priority
          className={`object-cover transition-all duration-1000 ${
            isLoaded ? 'scale-100 blur-0' : 'scale-110 blur-sm'
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-elevated to-background" />
      )}

      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />

      {/* 内容区域 */}
      <div className="absolute inset-0 flex flex-col justify-end">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-8 md:pb-12">
          {/* 实时状态标签 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-4"
          >
            {/* 热度指示器 */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/90 backdrop-blur-sm rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-xs font-medium text-background">直播中</span>
            </div>

            {/* 浏览量 */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
              <Eye className="w-3.5 h-3.5 text-white/80" />
              <span className="text-xs font-medium text-white/90">{viewCount} 次浏览</span>
            </div>

            {/* 选片数 */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 backdrop-blur-sm rounded-full">
                <Heart className="w-3.5 h-3.5 text-white fill-current" />
                <span className="text-xs font-medium text-white">{selectedCount} 张已选</span>
              </div>
            )}
          </motion.div>

          {/* 活动标题 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-2 leading-tight drop-shadow-lg">
              {album.title}
            </h1>
            {album.description && (
              <p className="text-sm md:text-lg text-white/80 max-w-2xl line-clamp-2 drop-shadow-md">
                {album.description}
              </p>
            )}
          </motion.div>

          {/* 活动信息 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 md:gap-6 text-white/80"
          >
            {/* 活动时间（优先显示，如果没有则显示创建时间） */}
            {eventDate ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDateTime(eventDate)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDate(album.created_at)}</span>
              </div>
            )}

            {/* 活动地点 */}
            {location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{location}</span>
              </div>
            )}

            {/* 照片数量 */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{album.photo_count} 张照片</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 向下滚动提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center text-white/60"
      >
        <span className="text-xs mb-1">向下滚动</span>
        <ChevronDown className="w-5 h-5 animate-bounce" />
      </motion.div>
    </div>
  )
}
