'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { FolderOpen, Eye, Calendar, ArrowRight } from 'lucide-react'
import type { Album } from '@/types/database'

interface AlbumGridProps {
  albums: Album[]
}

export function AlbumGrid({ albums }: AlbumGridProps) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'short'
    })
  }

  // 创建masonry布局的列配置（不同尺寸）
  const getGridColSpan = (index: number) => {
    // 每6个为一组，创建视觉节奏
    const pattern = index % 6
    if (pattern === 0) return 'md:col-span-2 md:row-span-2' // 大图
    if (pattern === 1) return 'md:col-span-1' // 正常
    if (pattern === 2) return 'md:col-span-1' // 正常
    if (pattern === 3) return 'md:col-span-2' // 宽图
    if (pattern === 4) return 'md:col-span-1' // 正常
    return 'md:col-span-1' // 正常
  }

  const getAspectRatio = (index: number) => {
    const pattern = index % 6
    if (pattern === 0) return 'aspect-[4/5] md:aspect-[4/5]' // 大图竖版
    if (pattern === 3) return 'aspect-[16/9]' // 宽图
    return 'aspect-[4/3]' // 标准
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {albums.map((album, index) => {
        const coverUrl = album.cover_photo_id
          ? `${mediaUrl}/processed/thumbs/${album.id}/${album.cover_photo_id}.jpg`
          : null

        return (
          <motion.div
            key={album.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ 
              duration: 0.6, 
              delay: Math.min(index * 0.08, 0.5),
              ease: 'easeOut'
            }}
            className={`group relative ${getGridColSpan(index)} overflow-hidden rounded-2xl bg-surface-elevated border border-border cursor-pointer hover:border-accent/30 transition-colors duration-300`}
          >
            <Link href={`/album/${album.slug}`} className="block h-full">
              {/* 图片容器 */}
              <div className={`relative ${getAspectRatio(index)} overflow-hidden bg-surface`}>
                {coverUrl ? (
                  <>
                    <Image
                      src={coverUrl}
                      alt={album.title}
                      fill
                      className="object-cover transition-all duration-500 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    {/* 渐变遮罩 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
                    <FolderOpen className="w-16 h-16 text-text-muted" />
                  </div>
                )}

                {/* Hover Overlay - 显示详细信息 */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-white drop-shadow-lg">
                      {album.title}
                    </h3>
                    
                    <div className="flex items-center gap-4 text-white/90 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4" />
                        <span>{album.photo_count} 张</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(album.created_at)}</span>
                      </div>
                    </div>

                    {/* CTA 按钮 */}
                    <div className="flex items-center gap-2 text-accent font-medium pt-2">
                      <span className="text-sm">查看作品</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </motion.div>
                </div>

                {/* 顶部标签（始终显示） */}
                <div className="absolute top-4 left-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full border border-white/20">
                    <span className="text-xs text-white font-medium">{album.photo_count} 张照片</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* 光效装饰 */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/0 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </motion.div>
        )
      })}
    </div>
  )
}
