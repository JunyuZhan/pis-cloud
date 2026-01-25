'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  quality?: number
  sizes?: string
  priority?: boolean
  blurDataURL?: string
  onError?: () => void
  aspectRatio?: number
  unoptimized?: boolean // 跳过 Next.js 优化，直接从 CDN 加载
}

/**
 * 优化的图片组件
 * - 优先图片（priority=true）立即加载
 * - 其他图片使用 Next.js 内置的 lazy loading（自动检测视口）
 * - 优化图片质量和尺寸
 * - 支持 BlurHash 占位符
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  quality = 75, // 默认降低质量以提高加载速度
  sizes,
  priority = false,
  blurDataURL,
  onError,
  aspectRatio,
  unoptimized = false, // 默认使用 Next.js 优化；CDN 已优化的图片可设为 true
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false)
  
  // 简化逻辑：优先图片立即加载，其他图片使用 Next.js 的 lazy loading
  // Next.js Image 组件已经内置了 Intersection Observer，不需要重复实现

  const handleError = () => {
    setImageError(true)
    onError?.()
  }

  // 如果 src 存在且没有错误，直接渲染 Image 组件
  // Next.js Image 组件已经内置了优化的懒加载机制
  if (!imageError && src) {
    return (
      <div className={cn('relative', fill ? 'w-full h-full' : '')}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          fill={fill}
          className={className}
          quality={quality}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          placeholder={blurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL}
          onError={handleError}
          unoptimized={unoptimized}
        />
      </div>
    )
  }

  // 错误状态或没有 src - 显示占位符
  return (
    <div
      className={cn(
        'relative flex items-center justify-center bg-surface-elevated',
        fill ? 'w-full h-full' : ''
      )}
      style={aspectRatio && !fill ? { paddingBottom: `${aspectRatio * 100}%` } : undefined}
    >
      {blurDataURL && !imageError ? (
        // 显示模糊占位符（如果有 BlurHash）
        <Image
          src={blurDataURL}
          alt=""
          fill
          className="object-cover blur-sm opacity-50"
          unoptimized
          aria-hidden="true"
        />
      ) : (
        <ImageIcon className="w-8 h-8 text-text-muted" />
      )}
    </div>
  )
}
