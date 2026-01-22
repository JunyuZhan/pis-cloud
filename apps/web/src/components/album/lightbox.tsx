'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
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
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
  const [mounted, setMounted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(index)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    photos.forEach((p) => {
      map[p.id] = p.is_selected
    })
    return map
  })
  // 跟踪哪些照片已加载原图
  const [loadedOriginals, setLoadedOriginals] = useState<Set<string>>(new Set())

  // 确保只在客户端挂载后渲染，避免 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])

  // 同步外部传入的 index 到内部 state
  useEffect(() => {
    if (open && index >= 0 && index < photos.length) {
      setCurrentIndex(index)
    }
  }, [index, open, photos.length])

  const currentPhoto = photos[currentIndex] || photos[0]

  // 构建 slides，默认使用预览图，已加载原图的则使用原图
  // 只在客户端挂载后构建，避免 hydration 错误
  const slides = useMemo(() => {
    if (!mounted || photos.length === 0) {
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

      // 如果已加载原图，使用原图；否则使用预览图
      const imageKey = loadedOriginals.has(photo.id) 
        ? photo.original_key 
        : (photo.preview_key || photo.thumb_key || photo.original_key)

      // 格式化日期时间（使用固定格式，避免服务端和客户端不一致）
      let formattedDateTime: string | undefined
      if (dateTime) {
        try {
          const date = new Date(dateTime)
          // 使用固定格式：YYYY-MM-DD HH:mm:ss
          formattedDateTime = date.toISOString().replace('T', ' ').slice(0, 19)
        } catch {
          formattedDateTime = undefined
        }
      }

      return {
        src: `${mediaUrl}/${imageKey}`,
        width: photo.width || 0,
        height: photo.height || 0,
        title: photo.filename,
        description: exifString || formattedDateTime,
        // 保存photo id和original_key用于后续加载原图
        photoId: photo.id,
        originalKey: photo.original_key,
        previewKey: photo.preview_key,
      }
    })
  }, [photos, loadedOriginals, mediaUrl, mounted])

  // 加载当前照片的原图
  const handleLoadOriginal = useCallback(() => {
    if (!currentPhoto || !mounted) return
    
    // 如果已经有预览图，才需要加载原图
    if (currentPhoto.preview_key && currentPhoto.preview_key !== currentPhoto.original_key) {
      setLoadedOriginals((prev) => new Set(prev).add(currentPhoto.id))
    }
  }, [currentPhoto, mounted])

  // 检查当前照片是否已加载原图
  // 如果照片有预览图且预览图与原图不同，且还没有加载过原图，则显示"查看原图"按钮
  const isOriginalLoaded = currentPhoto && mounted
    ? loadedOriginals.has(currentPhoto.id) || 
      !currentPhoto.preview_key || 
      currentPhoto.preview_key === currentPhoto.original_key ||
      !currentPhoto.original_key
    : false
  
  // 检查是否需要显示"查看原图"按钮
  const showLoadOriginalButton = currentPhoto && mounted && 
    currentPhoto.preview_key && 
    currentPhoto.original_key &&
    currentPhoto.preview_key !== currentPhoto.original_key &&
    !loadedOriginals.has(currentPhoto.id)

  // 通过 API 下载原图
  const handleDownload = useCallback(async () => {
    if (!currentPhoto || !mounted) return

    try {
      const res = await fetch(`/api/public/download/${currentPhoto.id}`)
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
  }, [currentPhoto, mounted])

  // 选片功能
  const handleSelect = useCallback(async () => {
    if (!currentPhoto || !mounted) return

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
  }, [currentPhoto, selectedMap, onSelectChange, mounted])

  // 防止 hydration 错误：只在客户端挂载后且打开时才渲染 Lightbox
  // yet-another-react-lightbox 不支持 SSR，必须完全在客户端渲染
  if (!mounted) {
    return null
  }

  // 如果未打开或没有照片，不渲染
  if (!open || photos.length === 0 || slides.length === 0) {
    return null
  }

  // 确保 currentIndex 有效
  const validIndex = currentIndex >= 0 && currentIndex < photos.length ? currentIndex : 0

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={validIndex}
      slides={slides}
      plugins={[Thumbnails, Zoom, Captions]}
      on={{
        view: ({ index }) => {
          if (index >= 0 && index < photos.length) {
            setCurrentIndex(index)
          }
        },
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
        buttons: [
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

          // 查看原图按钮（仅在需要时显示：有预览图、预览图与原图不同、且未加载过原图）
          showLoadOriginalButton && (
            <button
              key="load-original"
              type="button"
              onClick={handleLoadOriginal}
              className="yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/90 text-background hover:bg-accent transition-colors"
              aria-label="查看原图"
              title="查看原图"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-sm font-medium">查看原图</span>
            </button>
          ),

          // 下载按钮
          allowDownload && (
            <button
              key="download"
              type="button"
              onClick={handleDownload}
              className="yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="下载原图"
            >
              <Download className="w-5 h-5" />
            </button>
          ),

          'close',
        ].filter(Boolean),
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
