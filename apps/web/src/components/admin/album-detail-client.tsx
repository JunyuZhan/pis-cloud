'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Upload, Trash2, Check, Loader2, Heart, ImageIcon, Star, GripVertical } from 'lucide-react'
import { PhotoUploader } from './photo-uploader'
import { PhotoLightbox } from '@/components/album/lightbox'
import { PhotoGroupManager } from './photo-group-manager'
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [photoGroupMap, setPhotoGroupMap] = useState<Map<string, string[]>>(new Map())
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(album.cover_photo_id)
  const [isReordering, setIsReordering] = useState(false)
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 当 initialPhotos 更新时（例如 router.refresh() 后），同步更新本地 state
  useEffect(() => {
    setPhotos(initialPhotos)
    // 检查是否有处理中的照片
    const pending = initialPhotos.filter(p => p.status === 'pending' || p.status === 'processing')
    setProcessingCount(pending.length)
  }, [initialPhotos])

  // 加载照片分组映射
  useEffect(() => {
    const loadPhotoGroups = async () => {
      try {
        const response = await fetch(`/api/admin/albums/${album.id}/groups`)
        if (response.ok) {
          const data = await response.json()
          const groups = data.groups || []
          
          // 获取所有分组的照片关联
          const groupMap = new Map<string, string[]>()
          await Promise.all(
            groups.map(async (group: { id: string }) => {
              try {
                const photosResponse = await fetch(
                  `/api/admin/albums/${album.id}/groups/${group.id}/photos`
                )
                if (photosResponse.ok) {
                  const photosData = await photosResponse.json()
                  groupMap.set(group.id, photosData.photo_ids || [])
                }
              } catch (error) {
                console.error(`Failed to load photos for group ${group.id}:`, error)
              }
            })
          )
          setPhotoGroupMap(groupMap)
        }
      } catch (error) {
        console.error('Failed to load photo groups:', error)
      }
    }
    loadPhotoGroups()
  }, [album.id, photos.length])

  // 过滤照片
  const filteredPhotos = photos.filter((p) => {
    // 按选中状态过滤
    if (filterSelected && !p.is_selected) {
      return false
    }
    
    // 按分组过滤
    if (selectedGroupId) {
      const groupPhotoIds = photoGroupMap.get(selectedGroupId) || []
      return groupPhotoIds.includes(p.id)
    }
    
    return true
  })

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

    await deletePhotos(Array.from(selectedPhotos))
  }

  const handleDeletePhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!confirm('确定要删除这张照片吗？此操作不可恢复。')) {
      return
    }

    await deletePhotos([photoId])
  }

  const deletePhotos = async (photoIds: string[]) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/albums/${album.id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
        }),
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const result = await response.json()
      alert(result.message || '删除成功')
      
      // 更新本地状态
      setPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)))
      if (photoIds.length === selectedPhotos.size) {
        clearSelection()
      }
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
  const handleSetCover = async (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
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
    <div className="space-y-4 sm:space-y-6">
      {/* 分组管理器 - 移动端优化 */}
      <div className="card p-3 sm:p-4">
        <PhotoGroupManager
          albumId={album.id}
          selectedGroupId={selectedGroupId}
          onGroupSelect={setSelectedGroupId}
        />
      </div>

      {/* 操作栏 - 移动端优化 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* 筛选按钮 */}
          <button
            onClick={() => setFilterSelected(!filterSelected)}
            className={cn(
              "btn-ghost text-sm flex items-center gap-2 px-3 py-2.5 transition-colors min-h-[44px]",
              filterSelected ? "text-red-500 bg-red-500/10" : "text-text-secondary hover:text-text-primary active:scale-95"
            )}
            title="只看客户已选"
          >
            <Heart className={cn("w-4 h-4 flex-shrink-0", filterSelected && "fill-current")} />
            <span className="hidden sm:inline">只看已选 ({photos.filter(p => p.is_selected).length})</span>
            <span className="sm:hidden">已选 ({photos.filter(p => p.is_selected).length})</span>
          </button>
          
          <div className="w-px h-4 bg-border hidden sm:block" />

          {selectionMode ? (
            <>
              <span className="text-sm text-text-secondary hidden sm:inline">
                已选择 {selectedPhotos.size} 张
              </span>
              <button onClick={clearSelection} className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95">
                取消
              </button>
              {selectedPhotos.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedPhotos.size === 1 && (
                    <button
                      onClick={() => {
                        const photoId = Array.from(selectedPhotos)[0]
                        handleSetCover(photoId)
                        clearSelection()
                      }}
                      className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">设为封面</span>
                      <span className="sm:hidden">封面</span>
                    </button>
                  )}
                  {selectedGroupId && (
                    <button
                      onClick={async () => {
                        const photoIds = Array.from(selectedPhotos)
                        try {
                          const response = await fetch(
                            `/api/admin/albums/${album.id}/groups/${selectedGroupId}/photos`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ photo_ids: photoIds }),
                            }
                          )
                          if (response.ok) {
                            // 刷新分组映射
                            const groupMap = new Map(photoGroupMap)
                            const currentPhotoIds = groupMap.get(selectedGroupId) || []
                            groupMap.set(selectedGroupId, [...currentPhotoIds, ...photoIds])
                            setPhotoGroupMap(groupMap)
                            clearSelection()
                            alert('已添加到分组')
                          } else {
                            alert('添加到分组失败')
                          }
                        } catch (error) {
                          console.error('Failed to assign photos to group:', error)
                          alert('添加到分组失败')
                        }
                      }}
                      className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95"
                    >
                      <Star className="w-4 h-4" />
                      <span className="hidden sm:inline">添加到分组</span>
                      <span className="sm:hidden">分组</span>
                    </button>
                  )}
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50 min-h-[44px] px-3 py-2.5 active:scale-95"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span className="hidden sm:inline">删除</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95"
              >
                选择
              </button>
              <button
                onClick={() => setIsReordering(!isReordering)}
                className={cn(
                  "btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95",
                  isReordering && "bg-accent/10 text-accent"
                )}
              >
                <GripVertical className="w-4 h-4" />
                <span className="hidden sm:inline">{isReordering ? '完成排序' : '排序'}</span>
                <span className="sm:hidden">{isReordering ? '完成' : '排序'}</span>
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="btn-primary w-full sm:w-auto min-h-[44px] justify-center"
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

      {/* 照片网格 - 移动端优化 */}
      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {filteredPhotos.map((photo, index) => (
            <div
              key={photo.id}
              draggable={isReordering && !selectionMode}
              onDragStart={(e) => {
                if (isReordering) {
                  setDraggedPhotoId(photo.id)
                  e.dataTransfer.effectAllowed = 'move'
                }
              }}
              onDragOver={(e) => {
                if (isReordering && draggedPhotoId && draggedPhotoId !== photo.id) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverPhotoId(photo.id)
                }
              }}
              onDragLeave={() => {
                if (isReordering) {
                  setDragOverPhotoId(null)
                }
              }}
              onDrop={async (e) => {
                e.preventDefault()
                if (isReordering && draggedPhotoId && draggedPhotoId !== photo.id) {
                  const draggedIndex = filteredPhotos.findIndex(p => p.id === draggedPhotoId)
                  const dropIndex = filteredPhotos.findIndex(p => p.id === photo.id)
                  
                  if (draggedIndex !== -1 && dropIndex !== -1) {
                    // 重新排序照片数组
                    const newPhotos = [...filteredPhotos]
                    const [draggedPhoto] = newPhotos.splice(draggedIndex, 1)
                    newPhotos.splice(dropIndex, 0, draggedPhoto)
                    
                    // 更新本地状态
                    setPhotos(newPhotos)
                    
                    // 调用API保存排序
                    try {
                      const orders = newPhotos.map((p, i) => ({
                        photoId: p.id,
                        sortOrder: i + 1,
                      }))
                      
                      const response = await fetch('/api/admin/photos/reorder', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          albumId: album.id,
                          orders,
                        }),
                      })
                      
                      if (!response.ok) {
                        throw new Error('保存排序失败')
                      }
                      
                      router.refresh()
                    } catch (error) {
                      console.error('Failed to save photo order:', error)
                      alert('保存排序失败，请重试')
                      // 恢复原顺序
                      setPhotos(filteredPhotos)
                    }
                  }
                }
                setDraggedPhotoId(null)
                setDragOverPhotoId(null)
              }}
              onClick={() => {
                if (isReordering) return
                if (selectionMode) {
                  toggleSelection(photo.id)
                } else {
                  const idx = filteredPhotos.findIndex(p => p.id === photo.id)
                  setLightboxIndex(idx)
                }
              }}
              className={cn(
                'aspect-square bg-surface rounded-lg overflow-hidden relative group cursor-pointer transition-all',
                selectedPhotos.has(photo.id) && 'ring-2 ring-accent',
                isReordering && 'cursor-move',
                draggedPhotoId === photo.id && 'opacity-50 scale-95',
                dragOverPhotoId === photo.id && 'ring-2 ring-accent scale-105'
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

              {/* 排序拖拽指示器 */}
              {isReordering && (
                <div className="absolute top-2 right-2 z-10 bg-accent/90 p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                  <GripVertical className="w-4 h-4 text-background" />
                </div>
              )}

              {/* 操作按钮 (悬停显示) */}
              {!selectionMode && !isReordering && photo.thumb_key && (
                <div className="absolute bottom-2 left-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                  {coverPhotoId !== photo.id && (
                    <button
                      onClick={(e) => handleSetCover(photo.id, e)}
                      className="flex-1 bg-black/60 hover:bg-black/80 px-2 py-1.5 rounded-full text-xs text-white flex items-center justify-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" />
                      设为封面
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeletePhoto(photo.id, e)}
                    className="bg-red-500/80 hover:bg-red-600 px-2 py-1.5 rounded-full text-xs text-white flex items-center justify-center gap-1 min-w-[60px]"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-3 h-3" />
                    删除
                  </button>
                </div>
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
