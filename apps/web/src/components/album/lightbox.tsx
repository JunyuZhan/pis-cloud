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

  // 同步外部传入的 index 到内部 state
  useEffect(() => {
    if (open && index >= 0 && index < photos.length) {
      setCurrentIndex(index)
    }
  }, [index, open, photos.length])

  const currentPhoto = photos[currentIndex]

  // 构建 slides，默认使用预览图，已加载原图的则使用原图
  const slides = useMemo(() => photos.map((photo) => {
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

    return {
      src: `${mediaUrl}/${imageKey}`,
      width: photo.width || 0,
      height: photo.height || 0,
      title: photo.filename,
      description: exifString || (dateTime ? new Date(dateTime).toLocaleString() : undefined),
      // 保存photo id和original_key用于后续加载原图
      photoId: photo.id,
      originalKey: photo.original_key,
      previewKey: photo.preview_key,
    }
  }), [photos, loadedOriginals, mediaUrl])

  // 加载当前照片的原图
  const handleLoadOriginal = useCallback(() => {
    if (!currentPhoto) return
    
    // 如果已经有预览图，才需要加载原图
    if (currentPhoto.preview_key && currentPhoto.preview_key !== currentPhoto.original_key) {
      setLoadedOriginals((prev) => new Set(prev).add(currentPhoto.id))
    }
  }, [currentPhoto])

  // 检查当前照片是否已加载原图
  const isOriginalLoaded = currentPhoto 
    ? loadedOriginals.has(currentPhoto.id) || !currentPhoto.preview_key || currentPhoto.preview_key === currentPhoto.original_key
    : false

  // 通过 API 下载原图
  const handleDownload = useCallback(async () => {
    if (!currentPhoto) return

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
  }, [currentPhoto])

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

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={currentIndex}
      slides={slides}
      plugins={[Thumbnails, Zoom, Captions]}
      on={{
        view: ({ index }) => setCurrentIndex(index),
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

          // 查看原图按钮（仅在未加载原图时显示）
          !isOriginalLoaded && (
            <button
              key="load-original"
              type="button"
              onClick={handleLoadOriginal}
              className="yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/90 text-background hover:bg-accent transition-colors"
              aria-label="查看原图"
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
