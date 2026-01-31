'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, X, Aperture } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Album } from '@/types/database'

interface AlbumSplashScreenProps {
  album: Album
  posterImageUrl?: string | null
}

export function AlbumSplashScreen({ album, posterImageUrl }: AlbumSplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)

  // 获取网站信息
  const siteName = 'PIS - 专业级摄影分享'
  const siteDescription = '私有化即时摄影分享系统，让每一刻精彩即时呈现'
  const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
  const photographerTagline = process.env.NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE || '专业活动摄影'

  // 检查 URL 参数，如果已跳过则直接隐藏
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('skip_splash') === '1') {
      setIsVisible(false)
    }
  }, [])

  const handleEnter = () => {
    setIsVisible(false)
    // 添加 URL 参数，避免刷新后再次显示启动页
    const url = new URL(window.location.href)
    url.searchParams.set('skip_splash', '1')
    window.history.replaceState({}, '', url.toString())
  }

  if (!isVisible) {
    return null
  }

  const hasPosterImage = posterImageUrl && posterImageUrl.trim()
  const isDefaultSplash = !hasPosterImage

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-background"
          onClick={handleEnter}
        >
          {/* 背景：海报图片或渐变背景 */}
          <div className="absolute inset-0">
            {hasPosterImage ? (
              <>
                <div className="relative w-full h-full">
                  <Image
                    src={posterImageUrl!}
                    alt={album.title || siteName}
                    fill
                    className={`object-cover transition-opacity duration-500 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    priority
                    unoptimized
                  />
                </div>
                {/* 渐变遮罩，确保文字可读性 */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
              </>
            ) : (
              <>
                {/* 默认渐变背景 - 与网站风格一致 */}
                <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-elevated to-background" />
                {/* 装饰性光效 - 与 HomeHero 一致 */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
              </>
            )}
          </div>

          {/* 内容区域 */}
          <div className={`relative z-10 h-full flex flex-col items-center justify-center px-6 pb-24 sm:pb-32 ${
            hasPosterImage ? 'text-white' : 'text-white'
          }`}>
            {/* 关闭按钮 - 使用毛玻璃效果 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleEnter()
              }}
              className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full backdrop-blur-md transition-colors ${
                hasPosterImage
                  ? 'bg-black/30 hover:bg-black/50 text-white border border-white/20'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
              aria-label="跳过启动页"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 品牌标识（默认启动页显示）- 与 HomeHero 风格一致 */}
            {isDefaultSplash && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6"
              >
                <Aperture className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
                <span className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-white tracking-wider">
                  PIS
                </span>
              </motion.div>
            )}

            {/* 相册标题或网站名称 - 使用 serif 字体，与网站风格一致 */}
            {(album.title || isDefaultSplash) && (
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: isDefaultSplash ? 0.2 : 0.2, duration: 0.7, ease: 'easeOut' }}
                className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-center mb-4 drop-shadow-2xl leading-tight ${
                  hasPosterImage ? '' : ''
                }`}
              >
                {album.title || siteName}
                {isDefaultSplash && (
                  <>
                    <br />
                    <span className="text-accent text-xl sm:text-2xl md:text-3xl lg:text-4xl">{siteDescription}</span>
                  </>
                )}
              </motion.h1>
            )}

            {/* 相册描述或网站描述 */}
            {(album.description && !isDefaultSplash) && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
                className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 font-light tracking-wide max-w-2xl mx-auto text-center mb-4 drop-shadow-md"
              >
                {album.description}
              </motion.p>
            )}

            {/* 摄影师信息（仅默认启动页显示）- 使用毛玻璃效果 */}
            {isDefaultSplash && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                  <span className="text-sm sm:text-base text-white font-medium">
                    {photographerName}
                  </span>
                  <span className="w-1 h-1 bg-accent rounded-full" />
                  <span className="text-xs sm:text-sm text-white/80">
                    {photographerTagline}
                  </span>
                </div>
              </motion.div>
            )}

            {/* 进入提示 - 更显著的引导按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isDefaultSplash ? 0.6 : 0.5, duration: 0.5 }}
              className="absolute bottom-20 sm:bottom-12 flex flex-col items-center gap-3 w-full px-4"
            >
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEnter()
                }}
                className={`group relative px-6 py-3 sm:px-8 sm:py-4 rounded-full backdrop-blur-md border-2 transition-all duration-300 ${
                  hasPosterImage
                    ? 'bg-white/20 hover:bg-white/30 text-white border-white/40 hover:border-white/60 shadow-lg hover:shadow-xl'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50 shadow-lg hover:shadow-xl'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-sm sm:text-base md:text-lg font-medium tracking-wide flex items-center gap-2">
                  点击进入相册
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-y-1" />
                </span>
              </motion.button>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  repeatType: 'reverse'
                }}
                className="text-white/80"
              >
                <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
