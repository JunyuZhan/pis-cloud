'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
// X removed as it's not used
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface LongPressMenuProps {
  children: ReactNode
  menuItems: Array<{
    label: string
    icon?: ReactNode
    onClick: () => void
    variant?: 'default' | 'danger'
  }>
  delay?: number
  disabled?: boolean
}

/**
 * 长按菜单组件
 * 移动端友好的长按上下文菜单
 */
export function LongPressMenu({
  children,
  menuItems,
  delay = 500,
  disabled = false,
}: LongPressMenuProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLongPressing, setIsLongPressing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled) return

    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        const touch = e.touches[0]
        setMenuPosition({ x: touch.clientX, y: touch.clientY })
        setIsLongPressing(true)
        
        // 触觉反馈（如果支持）
        if ('vibrate' in navigator) {
          navigator.vibrate(50)
        }
      }, delay)
    }

    const handleTouchEnd = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const handleTouchMove = () => {
      // 移动时取消长按
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd)
    element.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchmove', handleTouchMove)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [delay, disabled])

  const closeMenu = () => {
    setMenuPosition(null)
    setIsLongPressing(false)
  }

  const handleMenuItemClick = (onClick: () => void) => {
    onClick()
    closeMenu()
  }

  return (
    <>
      <div ref={elementRef} className={cn(disabled && 'pointer-events-none')}>
        {children}
      </div>

      <AnimatePresence>
        {menuPosition && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
            />

            {/* 菜单 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-50 md:hidden"
              style={{
                left: typeof window !== 'undefined' ? `${Math.min(menuPosition.x, window.innerWidth - 200)}px` : `${menuPosition.x}px`,
                top: typeof window !== 'undefined' ? `${Math.min(menuPosition.y, window.innerHeight - 200)}px` : `${menuPosition.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="bg-surface border border-border rounded-lg shadow-xl min-w-[160px] overflow-hidden">
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleMenuItemClick(item.onClick)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      'hover:bg-surface-elevated active:bg-surface-elevated',
                      item.variant === 'danger' && 'text-red-400 hover:text-red-300',
                      item.variant !== 'danger' && 'text-text-primary'
                    )}
                  >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
