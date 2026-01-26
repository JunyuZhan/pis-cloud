'use client'

import { useState, useEffect } from 'react'
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
  
  // 当 src 改变时，重置错误状态，以便尝试加载新的图片
  // 这确保了降级机制能正常工作：当切换到下一个后备图片时，会重新尝试加载
  useEffect(() => {
    setImageError(false)
  }, [src])
  
  // 当 onError 回调改变时，也重置错误状态（用于父组件更新错误处理逻辑）
  useEffect(() => {
    setImageError(false)
  }, [onError])
  
  // 简化逻辑：优先图片立即加载，其他图片使用 Next.js 的 lazy loading
  // Next.js Image 组件已经内置了 Intersection Observer，不需要重复实现

  const handleError = (event?: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // 收集所有错误信息到一个字符串中，确保所有信息都能显示
    try {
      const srcValue = src ?? '(undefined)'
      const srcStr = typeof srcValue === 'string' && srcValue.length > 0
        ? `"${srcValue.substring(0, 150)}${srcValue.length > 150 ? '...' : ''}"`
        : '(empty or invalid)'
      const altValue = alt ?? '(undefined)'
      const altStr = typeof altValue === 'string' && altValue.length > 0 ? altValue : '(empty)'
      
      // 构建完整的错误信息字符串
      let errorDetails = `[OptimizedImage] Image load failed\n`
      errorDetails += `  src: ${srcStr}\n`
      errorDetails += `  alt: ${altStr}\n`
      errorDetails += `  src type: ${typeof src}, value: ${JSON.stringify(src)}\n`
      errorDetails += `  alt type: ${typeof alt}, value: ${JSON.stringify(alt)}\n`
      errorDetails += `  hasSrc: ${!!src}, srcLength: ${typeof src === 'string' ? src.length : 'N/A'}\n`
      errorDetails += `  props: width=${width ?? 'undefined'}, height=${height ?? 'undefined'}, fill=${fill}, unoptimized=${unoptimized}\n`
      
      if (event?.target) {
        const img = event.target as HTMLImageElement
        errorDetails += `  image element: currentSrc=${img.currentSrc || '(empty)'}, naturalWidth=${img.naturalWidth}, naturalHeight=${img.naturalHeight}\n`
      }
      
      // 使用单个 console.error 调用，包含所有信息
      console.error(errorDetails)
      
      // 同时使用 console.group 提供更好的可读性（如果浏览器支持）
      if (console.group) {
        console.group('[OptimizedImage] Image load failed - Details')
        console.log('src:', src)
        console.log('alt:', alt)
        console.log('props:', { width, height, fill, unoptimized })
        if (event?.target) {
          const img = event.target as HTMLImageElement
          console.log('image element:', {
            currentSrc: img.currentSrc,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          })
        }
        console.groupEnd()
      }
    } catch (logError) {
      // 如果日志记录本身出错，至少记录基本信息
      console.error('[OptimizedImage] Image load failed (logging error):', logError)
      console.error('[OptimizedImage] Raw values - src:', src, 'alt:', alt)
    }
    
    // 先调用父组件的错误处理（可能切换到下一个后备方案）
    onError?.()
    // 延迟设置错误状态，给父组件时间切换图片源
    setTimeout(() => {
      setImageError(true)
    }, 200)
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
