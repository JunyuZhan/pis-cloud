'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Upload, Trash2, Check, Loader2, Heart, ImageIcon, Star } from 'lucide-react'
import { PhotoUploader } from './photo-uploader'
import { PhotoLightbox } from '@/components/album/lightbox'
import type { Album, Photo } from '@/types/database'
import { cn } from '@/lib/utils'

interface AlbumDetailClientProps {
  album: Album
  initialPhotos: Photo[]
}

export function AlbumDetailClient({ album, initialPhotos }: AlbumDetailClientProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState(initialPhotos)
  const [showUploader, setShowUploader] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [processingCount, setProcessingCount] = useState(0)
  const [filterSelected, setFilterSelected] = useState(false)
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(album.cover_photo_id)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 当 initialPhotos 更新时（例如 router.refresh() 后），同步更新本地 state
  useEffect(() => {
    setPhotos(initialPhotos)
    // 检查是否有处理中的照片
    const pending = initialPhotos.filter(p => p.status === 'pending' || p.status === 'processing')
    setProcessingCount(pending.length)
  }, [initialPhotos])

  const filteredPhotos = filterSelected 
    ? photos.filter(p => p.is_selected)
    : photos

  // 轮询检查处理中的照片
  useEffect(() => {
    if (processingCount > 0) {
      // 开始轮询
      pollIntervalRef.current = setInterval(() => {
        router.refresh()
      }, 3000) // 每 3 秒刷新一次
    } else {
      // 停止轮询
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [processingCount, router])

  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  const toggleSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos)
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId)
    } else {
      newSelected.add(photoId)
    }
    setSelectedPhotos(newSelected)
  }

  const clearSelection = () => {
    setSelectedPhotos(new Set())
    setSelectionMode(false)
  }

  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0) return
    
    if (!confirm(`确定要删除选中的 ${selectedPhotos.size} 张照片吗？此操作不可恢复。`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/albums/${album.id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: Array.from(selectedPhotos),
        }),
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const result = await response.json()
      alert(result.message || '删除成功')
      
      // 更新本地状态
      setPhotos((prev) => prev.filter((p) => !selectedPhotos.has(p.id)))
      clearSelection()
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUploadComplete = () => {
    router.refresh()
  }

  // 设置封面
  const handleSetCover = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const response = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_photo_id: photoId }),
      })

      if (!response.ok) {
        throw new Error('设置封面失败')
      }

      setCoverPhotoId(photoId)
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('设置封面失败，请重试')
    }
  }

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 筛选按钮 */}
          <button
            onClick={() => setFilterSelected(!filterSelected)}
            className={cn(
              "btn-ghost text-sm flex items-center gap-2 px-3 py-2 transition-colors",
              filterSelected ? "text-red-500 bg-red-500/10" : "text-text-secondary hover:text-text-primary"
            )}
            title="只看客户已选"
          >
            <Heart className={cn("w-4 h-4", filterSelected && "fill-current")} />
            <span className="hidden sm:inline">只看已选 ({photos.filter(p => p.is_selected).length})</span>
            <span className="sm:hidden">已选 ({photos.filter(p => p.is_selected).length})</span>
          </button>
          
          <div className="w-px h-4 bg-border mx-2" />

          {selectionMode ? (
            <>
              <span className="text-sm text-text-secondary">
                已选择 {selectedPhotos.size} 张
              </span>
              <button onClick={clearSelection} className="btn-ghost text-sm">
                取消
              </button>
              {selectedPhotos.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  删除
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setSelectionMode(true)}
              className="btn-ghost text-sm"
            >
              选择
            </button>
          )}
        </div>
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="btn-primary"
        >
          <Upload className="w-4 h-4" />
          {showUploader ? '收起' : '上传照片'}
        </button>
      </div>

      {/* 上传区域 */}
      {showUploader && (
        <div className="card">
          <PhotoUploader
            albumId={album.id}
            onComplete={handleUploadComplete}
          />
        </div>
      )}

      {/* 处理状态提示 */}
      {processingCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg text-sm">
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
          <span className="text-text-secondary">
            {processingCount} 张照片正在处理中，将自动刷新...
          </span>
        </div>
      )}

      {/* 照片网格 */}
      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => {
                if (selectionMode) {
                  toggleSelection(photo.id)
                } else {
                  const index = filteredPhotos.findIndex(p => p.id === photo.id)
                  setLightboxIndex(index)
                }
              }}
              className={cn(
                'aspect-square bg-surface rounded-lg overflow-hidden relative group cursor-pointer',
                selectedPhotos.has(photo.id) && 'ring-2 ring-accent'
              )}
            >
              {photo.thumb_key ? (
                <Image
                  src={`${mediaUrl}/${photo.thumb_key}`}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-surface to-surface-elevated flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <span className="text-text-muted text-xs">处理中...</span>
                </div>
              )}

              {/* 封面标识 */}
              {coverPhotoId === photo.id && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="bg-accent/90 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm flex items-center gap-1">
                    <Star className="w-3 h-3 text-background fill-current" />
                    <span className="text-xs font-medium text-background">封面</span>
                  </div>
                </div>
              )}

              {/* 客户选片标识 (红心) */}
              {photo.is_selected && coverPhotoId !== photo.id && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="bg-red-500/90 p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                    <Heart className="w-3 h-3 text-white fill-current" />
                  </div>
                </div>
              )}

              {/* 设置封面按钮 (悬停显示) */}
              {!selectionMode && coverPhotoId !== photo.id && photo.thumb_key && (
                <button
                  onClick={(e) => handleSetCover(photo.id, e)}
                  className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 px-2 py-1 rounded-full text-xs text-white flex items-center gap-1"
                >
                  <ImageIcon className="w-3 h-3" />
                  设为封面
                </button>
              )}

              {/* 选择指示器 (管理员批量操作) */}
              {selectionMode && (
                <div
                  className={cn(
                    'absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10',
                    selectedPhotos.has(photo.id)
                      ? 'bg-accent border-accent'
                      : 'border-white/50 bg-black/30'
                  )}
                >
                  {selectedPhotos.has(photo.id) && (
                    <Check className="w-4 h-4 text-background" />
                  )}
                </div>
              )}

              {/* 悬停遮罩 */}
              {!selectionMode && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
          {filterSelected ? (
             <div className="space-y-4">
               <Heart className="w-16 h-16 text-text-muted mx-auto mb-4" />
               <h2 className="text-xl font-medium mb-2">暂无已选照片</h2>
               <p className="text-text-secondary">
                 访客还没有挑选任何照片，或者您可以通过筛选查看所有照片。
               </p>
               <button
                  onClick={() => setFilterSelected(false)}
                  className="btn-secondary mt-4"
                >
                  查看全部照片
                </button>
             </div>
          ) : !showUploader ? (
            /* 空状态 */
            <div className="space-y-4">
              <Upload className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">上传您的第一张照片</h2>
              <p className="text-text-secondary mb-6">
                支持 JPG、PNG、HEIC 格式，单文件最大 100MB
              </p>
              <button
                onClick={() => setShowUploader(true)}
                className="btn-primary"
              >
                <Upload className="w-4 h-4" />
                选择照片
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Lightbox 预览 */}
      <PhotoLightbox
        photos={filteredPhotos}
        index={lightboxIndex !== null ? lightboxIndex : -1}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        allowDownload={true}
      />
    </div>
  )
}
