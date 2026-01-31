'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  disabled?: boolean
  threshold?: number
  className?: string
}

/**
 * 下拉刷新组件
 * 移动端友好的下拉刷新实现
 */
export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
  className,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)

  useEffect(() => {
    if (disabled || isRefreshing) return

    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      // 只在顶部时允许下拉
      if (container.scrollTop > 0) return
      
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return

      currentY.current = e.touches[0].clientY
      const distance = currentY.current - startY.current

      if (distance > 0 && container.scrollTop === 0) {
        // 计算阻尼效果
        const dampedDistance = Math.min(distance * 0.5, threshold * 1.5)
        setPullDistance(dampedDistance)
        e.preventDefault()
      }
    }

    const handleTouchEnd = async () => {
      if (!isPulling) return

      setIsPulling(false)

      if (pullDistance >= threshold) {
        setIsRefreshing(true)
        setPullDistance(0)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      } else {
        setPullDistance(0)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [disabled, isRefreshing, isPulling, pullDistance, threshold, onRefresh])

  const pullProgress = Math.min(pullDistance / threshold, 1)
  const showIndicator = pullDistance > 0 || isRefreshing

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      style={{
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* 下拉刷新指示器 */}
      {showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 transition-opacity"
          style={{
            height: `${Math.max(pullDistance, 60)}px`,
            opacity: showIndicator ? 1 : 0,
            transform: `translateY(${-Math.max(pullDistance, 60) + 30}px)`,
          }}
        >
          <div className="flex flex-col items-center gap-2">
            {isRefreshing ? (
              <>
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <span className="text-sm text-text-secondary">刷新中...</span>
              </>
            ) : (
              <>
                <div
                  className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full transition-transform"
                  style={{
                    transform: `rotate(${pullProgress * 360}deg)`,
                  }}
                />
                <span className="text-sm text-text-secondary">
                  {pullProgress >= 1 ? '释放刷新' : '下拉刷新'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 内容 */}
      <div
        style={{
          transform: `translateY(${Math.max(pullDistance, 0)}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
