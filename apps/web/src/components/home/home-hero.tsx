'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ChevronDown, Aperture } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Album, Photo } from '@/types/database'

interface HomeHeroProps {
  featuredAlbum?: Album | null
  coverPhoto?: Photo | null
}

export function HomeHero({ featuredAlbum, coverPhoto }: HomeHeroProps) {
  const t = useTranslations('home.hero')
  const [isLoaded, setIsLoaded] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
  const { scrollY } = useScroll()

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Parallax效果：背景图片随滚动移动
  const backgroundY = useTransform(
    scrollY,
    [0, 600],
    ['0%', '30%']
  )

  // 获取封面图 URL
  const coverUrl = coverPhoto?.preview_key 
    ? `${mediaUrl}/${coverPhoto.preview_key}`
    : coverPhoto?.thumb_key 
      ? `${mediaUrl}/${coverPhoto.thumb_key}`
      : null

  return (
    <div className="relative w-full h-[70vh] sm:h-[75vh] min-h-[400px] sm:min-h-[500px] max-h-[600px] sm:max-h-[800px] overflow-hidden pt-14 sm:pt-16">
      {/* 背景图片 - 带parallax效果 */}
      {coverUrl ? (
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : backgroundY,
          }}
          className="absolute inset-0 -z-10"
        >
          <div className="absolute inset-0 w-full h-[130%]">
            <Image
              src={coverUrl}
              alt={featuredAlbum?.title || process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'}
              fill
              priority
              className={`object-cover transition-all duration-1000 ${
                isLoaded ? 'scale-100 blur-0' : 'scale-110 blur-md'
              }`}
              onLoad={() => setIsLoaded(true)}
              sizes="100vw"
            />
          </div>
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-elevated to-background" />
      )}

      {/* 渐变遮罩 - 多层叠加创造深度 */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />

      {/* 内容区域 */}
      <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4 sm:px-6 z-10">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Logo/品牌标识 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1 sm:mb-2"
          >
            <Aperture className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
            <span className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-white tracking-wider">
              PIS
            </span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
            className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white drop-shadow-2xl leading-tight px-2"
          >
            {t('title')}
            <br />
            <span className="text-accent">{t('subtitle')}</span>
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 font-light tracking-wide max-w-2xl mx-auto px-2"
          >
            {t('tagline')}
          </motion.p>

          {/* 特色相册信息 */}
          {featuredAlbum && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
              className="pt-2 sm:pt-4"
            >
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <span className="text-[10px] sm:text-xs text-white/80">{t('latest')}</span>
                <span className="w-1 h-1 bg-accent rounded-full" />
                <span className="text-xs sm:text-sm text-white font-medium line-clamp-1 max-w-[200px] sm:max-w-none">
                  {featuredAlbum.title}
                </span>
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
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/70 cursor-pointer hover:text-white transition-colors touch-manipulation"
      >
        <span className="text-[10px] sm:text-xs mb-1 sm:mb-2 tracking-wider uppercase">{t('explore')}</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: 'easeInOut',
            repeatType: 'reverse'
          }}
        >
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.div>
      </motion.a>

      {/* 装饰性光效 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
    </div>
  )
}
