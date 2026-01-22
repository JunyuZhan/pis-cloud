'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import type { Album, Photo } from '@/types/database'

interface HomeHeroProps {
  featuredAlbum?: Album | null
  coverPhoto?: Photo | null
}

export function HomeHero({ featuredAlbum, coverPhoto }: HomeHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  // 获取封面图 URL
  const coverUrl = coverPhoto?.preview_key 
    ? `${mediaUrl}/${coverPhoto.preview_key}`
    : coverPhoto?.thumb_key 
      ? `${mediaUrl}/${coverPhoto.thumb_key}`
      : null

  return (
    <div className="relative w-full h-screen min-h-[600px] overflow-hidden">
      {/* 背景图片 */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={featuredAlbum?.title || 'PIS Photography'}
          fill
          priority
          className={`object-cover transition-all duration-1000 ${
            isLoaded ? 'scale-100 blur-0' : 'scale-110 blur-md'
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-elevated to-background" />
      )}

      {/* 渐变遮罩 - 多层叠加创造深度 */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />

      {/* 内容区域 */}
      <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Logo/品牌标识 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="relative">
              <Sparkles className="w-8 h-8 text-accent animate-pulse" />
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            </div>
            <span className="text-3xl md:text-4xl font-serif font-bold text-white tracking-wider">
              PIS
            </span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white drop-shadow-2xl leading-tight"
          >
            专业摄影
            <br />
            <span className="text-accent">作品集</span>
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="text-xl md:text-2xl text-white/90 font-light tracking-wide max-w-2xl mx-auto"
          >
            捕捉每一个精彩瞬间，让光影诉说故事
          </motion.p>

          {/* 特色相册信息 */}
          {featuredAlbum && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
              className="pt-8"
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <span className="text-sm text-white/80">最新作品</span>
                <span className="w-1 h-1 bg-accent rounded-full" />
                <span className="text-white font-medium">{featuredAlbum.title}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 向下滚动提示 */}
      <motion.a
        href="#works"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/70 cursor-pointer hover:text-white transition-colors"
      >
        <span className="text-xs mb-2 tracking-wider uppercase">探索作品</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: 'easeInOut',
            repeatType: 'reverse'
          }}
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </motion.a>

      {/* 装饰性光效 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
    </div>
  )
}
