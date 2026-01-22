'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Upload, Trash2, Check, Loader2 } from 'lucide-react'
import { PhotoUploader } from './photo-uploader'
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

  // 当 initialPhotos 更新时（例如 router.refresh() 后），同步更新本地 state
  useEffect(() => {
    setPhotos(initialPhotos)
  }, [initialPhotos])

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

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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

      {/* 照片网格 */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => selectionMode && toggleSelection(photo.id)}
              className={cn(
                'aspect-square bg-surface rounded-lg overflow-hidden relative group cursor-pointer',
                selectionMode && 'cursor-pointer',
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
                <div className="w-full h-full bg-gradient-to-br from-surface to-surface-elevated flex items-center justify-center">
                  <span className="text-text-muted text-xs">处理中...</span>
                </div>
              )}

              {/* 选择指示器 */}
              {selectionMode && (
                <div
                  className={cn(
                    'absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
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
      ) : !showUploader ? (
        /* 空状态 */
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
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
  )
}
