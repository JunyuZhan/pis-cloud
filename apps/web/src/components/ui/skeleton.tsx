'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

/**
 * 骨架屏组件
 * 用于加载状态的占位符
 */
export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  ...props
}: SkeletonProps & React.HTMLAttributes<HTMLDivElement>) {
  const baseClasses = 'animate-pulse bg-surface-elevated rounded'
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? undefined : '1rem'),
    ...props.style,
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
      {...props}
    />
  )
}

/**
 * 相册卡片骨架屏
 */
export function AlbumCardSkeleton() {
  return (
    <div className="card">
      {/* 封面图骨架 */}
      <div className="aspect-[4/3] bg-surface rounded-lg mb-4 animate-pulse" />
      
      {/* 标题骨架 */}
      <Skeleton variant="text" className="h-5 w-3/4 mb-2" />
      
      {/* 信息骨架 */}
      <div className="space-y-2">
        <Skeleton variant="text" className="h-4 w-1/2" />
        <Skeleton variant="text" className="h-3 w-2/3" />
      </div>
    </div>
  )
}

/**
 * 照片卡片骨架屏
 */
export function PhotoCardSkeleton() {
  return (
    <div className="aspect-square bg-surface rounded-lg animate-pulse" />
  )
}
