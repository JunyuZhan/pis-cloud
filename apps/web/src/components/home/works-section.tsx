'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { Album } from '@/types/database'
import { AlbumGrid } from './album-grid'

interface WorksSectionProps {
  albums: Album[]
}

/**
 * 获取随机背景图片URL
 * 使用环境变量配置的图片API，避免硬编码外部域名
 */
function getBackgroundImageUrl(): string {
  const width = 1920
  const height = 1080
  const randomSeed = Math.floor(Math.random() * 1000)
  
  // 从环境变量获取图片API配置
  const imageApiProvider = process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PROVIDER || 'picsum'
  const customImageApiUrl = process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_API_URL
  
  // 如果配置了自定义API URL，使用自定义URL
  if (customImageApiUrl) {
    return customImageApiUrl.replace('{width}', width.toString())
                           .replace('{height}', height.toString())
                           .replace('{random}', randomSeed.toString())
  }
  
  // 根据配置选择图片API提供商
  switch (imageApiProvider) {
    case 'unsplash':
      return `https://source.unsplash.com/${width}x${height}/?photography,art,nature&sig=${randomSeed}`
    case 'picsum':
    default:
      return `https://picsum.photos/${width}/${height}?random=${randomSeed}`
  }
}

export function WorksSection({ albums }: WorksSectionProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const t = useTranslations('home')
  
  // 在客户端获取背景图片URL
  useEffect(() => {
    setBackgroundUrl(getBackgroundImageUrl())
  }, [])

  return (
    <section 
      id="works" 
      className="relative py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6 overflow-hidden"
    >
      {/* 背景图片层 */}
      {backgroundUrl && !imageError && (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={backgroundUrl}
              alt={t('works')}
              fill
              priority
              className={`object-cover transition-opacity duration-1000 ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => {
                setImageError(true)
                setIsImageLoaded(false)
              }}
              sizes="100vw"
              quality={75}
              unoptimized // 外部图片API，不需要Next.js优化
            />
          </div>
          {/* 背景遮罩 - 增强对比度和层次感 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/50" />
        </div>
      )}
      
      {/* Fallback: 如果图片加载失败，显示渐变背景 */}
      {imageError && (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-surface via-surface-elevated to-background" />
      )}

      {/* 内容区域 - 毛玻璃效果 */}
      <div className="relative max-w-7xl mx-auto">
        {/* 毛玻璃容器 - 增强视觉效果 */}
        <div className="backdrop-blur-xl bg-background/70 dark:bg-background/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/20 dark:border-white/10 shadow-2xl">
          {/* 标题区域 */}
          <div className="mb-4 sm:mb-6 text-center">
            <h2 className="text-sm sm:text-base md:text-lg font-medium text-text-secondary">
              {t('works')}
            </h2>
          </div>

          {/* 相册网格 */}
          <AlbumGrid albums={albums} />
        </div>
      </div>
    </section>
  )
}
