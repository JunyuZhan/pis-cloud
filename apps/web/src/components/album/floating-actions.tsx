'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowUp, 
  Download, 
  ArrowUpDown, 
  ChevronUp,
  Share2,
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SortToggle, type SortRule } from './sort-toggle'
import { showInfo, showError, handleApiError } from '@/lib/toast'
import type { Album } from '@/types/database'
import { cn } from '@/lib/utils'

interface FloatingActionsProps {
  album: Album
  currentSort: SortRule
}

export function FloatingActions({ album, currentSort }: FloatingActionsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 确保只在客户端渲染
  useEffect(() => {
    setMounted(true)
  }, [])

  // 监听滚动，显示/隐藏回到顶部按钮
  useEffect(() => {
    if (!mounted) return

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500)
    }

    // 初始化检查
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mounted])

  // 回到顶部
  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsExpanded(false)
  }

  // 切换排序（循环切换：降序 -> 升序 -> 上传时间 -> 降序）
  const handleSortToggle = () => {
    const params = new URLSearchParams(searchParams.toString())
    const currentSortValue = searchParams.get('sort') || album.sort_rule || 'capture_desc'
    
    // 循环切换排序规则
    let newSort: SortRule = 'capture_desc'
    if (currentSortValue === 'capture_desc') {
      newSort = 'capture_asc'
    } else if (currentSortValue === 'capture_asc') {
      newSort = 'upload_desc'
    } else {
      newSort = 'capture_desc'
    }
    
    params.set('sort', newSort)
    router.push(`?${params.toString()}`, { scroll: false })
    setIsExpanded(false)
  }

  // 下载整个相册（访客使用批量下载已选照片的API）
  const handleDownloadAlbum = async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    if (!album.allow_download) {
      showInfo('此相册不允许下载')
      return
    }

    if (!album.allow_batch_download) {
      showInfo('此相册不允许批量下载')
      return
    }

    // 对于访客，使用批量下载已选照片的API
    // 如果没有已选照片，提示用户先选片
    const selectedCount = (album as any).selected_count || 0
    
    if (selectedCount === 0) {
      showInfo('请先选择您喜欢的照片（点击照片上的❤️图标），然后下载已选照片。')
      setIsExpanded(false)
      return
    }

    setDownloading(true)
    try {
      // 使用公开API下载已选照片
      const response = await fetch(`/api/public/albums/${album.slug}/download-selected`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || '下载失败')
      }

      const data = await response.json()
      
      // 如果有下载链接，逐个下载
      if (data.photos && data.photos.length > 0) {
        // 逐个下载照片，避免浏览器阻止多个下载
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i]
          setTimeout(() => {
            const a = document.createElement('a')
            a.href = photo.url
            a.download = photo.filename
            a.target = '_blank'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }, i * 300) // 每300ms下载一张，避免浏览器阻止
        }
        
        setDownloading(false)
        setIsExpanded(false)
        showInfo(`正在下载 ${data.count} 张照片，请稍候...`)
      } else {
        throw new Error('未获取到下载链接')
      }
    } catch (error: any) {
      console.error('Download error:', error)
      handleApiError(error, '下载失败，请重试')
      setDownloading(false)
    }
  }

  // 获取当前排序显示文本
  const getSortLabel = () => {
    switch (currentSort) {
      case 'capture_desc':
        return '时间降序'
      case 'capture_asc':
        return '时间升序'
      case 'upload_desc':
        return '上传时间'
      default:
        return '时间降序'
    }
  }

  return (
    <>
      {/* 浮动操作按钮组 - 只在客户端挂载后显示 */}
      {mounted && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* 展开的按钮列表 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2 mb-2"
            >
              {/* 排序按钮 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSortToggle}
                className={cn(
                  'w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
                  'bg-surface border border-border hover:bg-surface-elevated',
                  'text-text-primary transition-all backdrop-blur-sm',
                  'min-h-[48px] min-w-[48px]' // 移动端最小触摸目标
                )}
                title={getSortLabel()}
              >
                <ArrowUpDown className="w-5 h-5" />
              </motion.button>

              {/* 下载相册按钮 */}
              {album.allow_download && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownloadAlbum}
                  disabled={downloading}
                  className={cn(
                    'w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
                    'bg-accent hover:bg-accent/90 text-background',
                    'transition-all backdrop-blur-sm',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'min-h-[48px] min-w-[48px]' // 移动端最小触摸目标
                  )}
                  title={downloading ? '打包中...' : '下载整个相册'}
                >
                  {downloading ? (
                    <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </motion.button>
              )}

              {/* 分享按钮 */}
              {mounted && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (typeof window === 'undefined') return
                    const shareUrl = `${window.location.origin}/album/${album.slug}`
                    if (navigator.share) {
                      navigator.share({
                        title: album.title,
                        text: album.description || `查看 ${album.title} 的精彩照片`,
                        url: shareUrl,
                      }).catch(() => {
                        // 用户取消分享，不做处理
                      })
                    } else {
                      // 复制链接到剪贴板
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        showInfo('链接已复制到剪贴板')
                      }).catch(() => {
                        showError('复制失败，请手动复制链接')
                      })
                    }
                    setIsExpanded(false)
                  }}
                  className={cn(
                    'w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
                    'bg-surface border border-border hover:bg-surface-elevated',
                    'text-text-primary transition-all backdrop-blur-sm',
                    'min-h-[48px] min-w-[48px]' // 移动端最小触摸目标
                  )}
                  title="分享相册"
                >
                  <Share2 className="w-5 h-5" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 主按钮 - 展开/收起 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
            'bg-accent hover:bg-accent/90 text-background',
            'transition-all backdrop-blur-sm',
            'min-h-[56px] min-w-[56px]' // 移动端最小触摸目标
          )}
          aria-label={isExpanded ? '收起菜单' : '展开菜单'}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <X className="w-6 h-6" />
            ) : (
              <ChevronUp className="w-6 h-6" />
            )}
          </motion.div>
        </motion.button>

        {/* 回到顶部按钮（仅在滚动后显示） */}
        <AnimatePresence>
          {showBackToTop && !isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackToTop}
              className={cn(
                'w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
                'bg-surface border border-border hover:bg-surface-elevated',
                'text-text-primary transition-all backdrop-blur-sm',
                'min-h-[48px] min-w-[48px]' // 移动端最小触摸目标
              )}
              aria-label="回到顶部"
              title="回到顶部"
            >
              <ArrowUp className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

          {/* 移动端底部安全区域占位 */}
          <div className="h-20 md:h-0" />
        </div>
      )}
    </>
  )
}
