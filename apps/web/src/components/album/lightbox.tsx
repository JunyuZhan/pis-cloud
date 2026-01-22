'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import { Download, Heart, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/database'

interface PhotoLightboxProps {
  photos: Photo[]
  index: number
  open: boolean
  onClose: () => void
  allowDownload?: boolean
  onSelectChange?: (photoId: string, isSelected: boolean) => void
}

export function PhotoLightbox({
  photos,
  index,
  open,
  onClose,
  allowDownload = true,
  onSelectChange,
}: PhotoLightboxProps) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
  const [currentIndex, setCurrentIndex] = useState(index)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    photos.forEach((p) => {
      map[p.id] = p.is_selected
    })
    return map
  })
  // 跟踪哪些照片已加载原图（用户点击"查看原图"后）
  // 移除此逻辑，现在默认只显示大预览图，下载时才获取原图
  // const [loadedOriginals, setLoadedOriginals] = useState<Set<string>>(new Set())
  const prevIndexRef = useRef(index)

  // 同步外部传入的 index 到内部 state
  useEffect(() => {
    if (open && index >= 0 && index < photos.length && index !== prevIndexRef.current) {
      prevIndexRef.current = index
      setCurrentIndex(index)
    }
  }, [index, open, photos.length])

  // 使用 useMemo 稳定 currentPhoto 的引用，避免无限循环
  const currentPhoto = useMemo(() => {
    return photos[currentIndex] || photos[0]
  }, [photos, currentIndex])
  
  // 使用 useMemo 稳定 currentPhotoId，避免依赖整个对象
  const currentPhotoId = useMemo(() => currentPhoto?.id, [currentPhoto])

  // 构建 slides，默认使用预览图，点击"查看原图"后才使用原图
  const slides = useMemo(() => {
    if (photos.length === 0) {
      return []
    }
    
    return photos.map((photo) => {
      const exif = photo.exif as Record<string, unknown> | null
      const make = (exif?.image as Record<string, unknown>)?.Make || (exif?.Make as string)
      const model = (exif?.image as Record<string, unknown>)?.Model || (exif?.Model as string)
      const exifData = exif?.exif as Record<string, unknown> | undefined
      const fNumber = exifData?.FNumber as number | undefined
      const exposureTime = exifData?.ExposureTime as number | undefined
      const iso = exifData?.ISO as number | undefined
      const focalLength = exifData?.FocalLength as number | undefined
      const dateTime = (exifData?.DateTimeOriginal as string) || photo.captured_at

      const exifString = [
        make && model ? `${make} ${model}` : null,
        fNumber ? `f/${fNumber}` : null,
        exposureTime
          ? exposureTime < 1
            ? `1/${Math.round(1 / exposureTime)}s`
            : `${exposureTime}s`
          : null,
        iso ? `ISO${iso}` : null,
        focalLength ? `${focalLength}mm` : null,
      ]
        .filter(Boolean)
        .join(' · ')

      // 格式化日期时间（使用固定格式）
      let formattedDateTime: string | undefined
      if (dateTime) {
        try {
          const date = new Date(dateTime)
          formattedDateTime = date.toISOString().replace('T', ' ').slice(0, 19)
        } catch {
          formattedDateTime = undefined
        }
      }

      // 默认使用预览图（preview_key），如果用户点击了"查看原图"才使用原图（original_key）
      // 优先级：已加载原图 -> 预览图 -> 缩略图 -> 原图（作为后备）
      // 修改：只使用预览图（如果有），下载时才使用原图
      const imageKey = photo.preview_key || photo.thumb_key || photo.original_key

      return {
        src: imageKey ? `${mediaUrl}/${imageKey}` : '',
        width: photo.width || 0,
        height: photo.height || 0,
        title: photo.filename || '',
        description: exifString || formattedDateTime || '',
        photoId: photo.id,
        originalKey: photo.original_key,
        previewKey: photo.preview_key,
      }
    })
  }, [photos, mediaUrl])

  // 加载当前照片的原图 - 已移除
  // const handleLoadOriginal = useCallback(() => {
  //   if (!currentPhotoId || !currentPhoto?.original_key) return
  //   
  //   // 将照片ID添加到已加载原图集合，触发 slides 重新计算使用原图
  //   setLoadedOriginals((prev) => new Set(prev).add(currentPhotoId))
  // }, [currentPhotoId, currentPhoto])

  // 检查是否需要显示"查看原图"按钮 - 已移除
  // const showLoadOriginalButton = useMemo(() => {
  //   return currentPhoto && 
  //     currentPhoto.original_key &&
  //     !loadedOriginals.has(currentPhoto.id) &&
  //     // 如果当前显示的是预览图，且预览图与原图不同，才显示按钮
  //     (currentPhoto.preview_key 
  //       ? currentPhoto.preview_key !== currentPhoto.original_key
  //       : true) // 如果没有预览图但原图存在，也显示按钮
  // }, [currentPhoto, loadedOriginals])

  // 通过 API 下载原图
  const handleDownload = useCallback(async () => {
    if (!currentPhotoId) return

    try {
      const res = await fetch(`/api/public/download/${currentPhotoId}`)
      if (!res.ok) {
        const error = await res.json()
        alert(error.error?.message || '下载失败')
        return
      }

      const { downloadUrl, filename } = await res.json()

      // 触发下载
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      alert('下载失败，请重试')
    }
  }, [currentPhotoId])

  // 选片功能
  const handleSelect = useCallback(async () => {
    if (!currentPhoto) return

    const newSelected = !selectedMap[currentPhoto.id]
    setSelectedMap((prev) => ({ ...prev, [currentPhoto.id]: newSelected }))

    try {
      const res = await fetch(`/api/public/photos/${currentPhoto.id}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSelected: newSelected }),
      })

      if (!res.ok) {
        // 回滚
        setSelectedMap((prev) => ({ ...prev, [currentPhoto.id]: !newSelected }))
      } else {
        onSelectChange?.(currentPhoto.id, newSelected)
      }
    } catch {
      setSelectedMap((prev) => ({ ...prev, [currentPhoto.id]: !newSelected }))
    }
  }, [currentPhoto, selectedMap, onSelectChange])

  // 处理视图变化，使用 useCallback 避免在渲染期间更新状态
  const handleView = useCallback(({ index: newIndex }: { index: number }) => {
    if (newIndex >= 0 && newIndex < photos.length && newIndex !== prevIndexRef.current) {
      prevIndexRef.current = newIndex
      setCurrentIndex(newIndex)
    }
  }, [photos.length])

  // 如果未打开或没有照片，不渲染
  if (!open || photos.length === 0) {
    return null
  }

  // 确保 currentIndex 有效
  const validIndex = currentIndex >= 0 && currentIndex < photos.length ? currentIndex : 0

  // 构建工具栏按钮数组，确保稳定的引用以避免 hydration 问题
  const toolbarButtons = useMemo(() => {
    const buttons: Array<React.ReactNode> = [
      // 选片按钮
      <button
        key="select"
        type="button"
        onClick={handleSelect}
        className={cn(
          'yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
          selectedMap[currentPhoto?.id]
            ? 'bg-red-500 text-white'
            : 'bg-white/10 text-white hover:bg-white/20'
        )}
        aria-label={selectedMap[currentPhoto?.id] ? '取消选择' : '选择'}
      >
        <Heart
          className={cn(
            'w-5 h-5',
            selectedMap[currentPhoto?.id] && 'fill-current'
          )}
        />
      </button>,
    ]

    // 查看原图按钮（已移除）
    // if (showLoadOriginalButton) {
    //   buttons.push(
    //     <button
    //       key="load-original"
    //       type="button"
    //       onClick={handleLoadOriginal}
    //       className="yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/90 text-background hover:bg-accent transition-colors"
    //       aria-label="查看原图"
    //       title="查看原图"
    //     >
    //       <ImageIcon className="w-5 h-5" />
    //       <span className="text-sm font-medium">查看原图</span>
    //     </button>
    //   )
    // }

    // 下载按钮
    if (allowDownload) {
      buttons.push(
        <button
          key="download"
          type="button"
          onClick={handleDownload}
          className="yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="下载原图"
        >
          <Download className="w-5 h-5" />
        </button>
      )
    }

    buttons.push('close')
    return buttons
  }, [currentPhoto, selectedMap, allowDownload, handleSelect, handleDownload])

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={validIndex}
      slides={slides}
      plugins={[Thumbnails, Zoom, Captions]}
      on={{
        view: handleView,
      }}
      captions={{ descriptionTextAlign: 'center', showToggle: true }}
      carousel={{
        finite: false,
        preload: 2,
      }}
      render={{
        buttonPrev: photos.length <= 1 ? () => null : undefined,
        buttonNext: photos.length <= 1 ? () => null : undefined,
      }}
      toolbar={{
        buttons: toolbarButtons,
      }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, .95)' },
        captionsDescriptionContainer: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '10px',
        },
      }}
    />
  )
}
