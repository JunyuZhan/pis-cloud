'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, FolderOpen, Trash2, Check, Loader2, Copy } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { CreateAlbumDialog } from './create-album-dialog'
import type { Album } from '@/types/database'
import { cn } from '@/lib/utils'

export type AlbumWithCover = Album & {
  cover_thumb_key?: string | null
}

interface AlbumListProps {
  initialAlbums: AlbumWithCover[]
}

export function AlbumList({ initialAlbums }: AlbumListProps) {
  const router = useRouter()
  const [albums, setAlbums] = useState<AlbumWithCover[]>(initialAlbums)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedAlbums, setSelectedAlbums] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  useEffect(() => {
    setAlbums(initialAlbums)
  }, [initialAlbums])

  const toggleSelection = (albumId: string) => {
    const newSelected = new Set(selectedAlbums)
    if (newSelected.has(albumId)) {
      newSelected.delete(albumId)
    } else {
      newSelected.add(albumId)
    }
    setSelectedAlbums(newSelected)
  }

  const clearSelection = () => {
    setSelectedAlbums(new Set())
    setSelectionMode(false)
  }

  const handleBatchDelete = async () => {
    if (selectedAlbums.size === 0) return

    if (!confirm(`确定要删除选中的 ${selectedAlbums.size} 个相册吗？此操作不可恢复。`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/albums/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumIds: Array.from(selectedAlbums),
        }),
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const result = await response.json()
      alert(result.message || '删除成功')

      // 更新本地状态
      setAlbums((prev) => prev.filter((a) => !selectedAlbums.has(a.id)))
      clearSelection()
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async (albumId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('确定要复制这个相册吗？将复制所有配置，但不包含照片。')) {
      return
    }

    setDuplicatingId(albumId)
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/duplicate`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('复制失败')
      }

      const result = await response.json()
      alert('相册已复制')
      router.refresh()
      router.push(`/admin/albums/${result.id}`)
    } catch (error) {
      console.error(error)
      alert('复制失败，请重试')
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDeleteAlbum = async (albumId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('确定要删除这个相册吗？此操作不可恢复。')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/albums/${albumId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const result = await response.json()
      alert(result.message || '删除成功')
      
      // 更新本地状态
      setAlbums((prev) => prev.filter((a) => a.id !== albumId))
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold">我的相册</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            管理您的所有摄影作品集
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectionMode ? (
            <>
              <span className="text-sm text-text-secondary">
                已选择 {selectedAlbums.size} 个
              </span>
              <button onClick={clearSelection} className="btn-ghost text-sm">
                取消
              </button>
              {selectedAlbums.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  删除
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="btn-secondary w-full md:w-auto"
              >
                批量管理
              </button>
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="btn-primary w-full md:w-auto"
              >
                <Plus className="w-4 h-4" />
                新建相册
              </button>
            </>
          )}
        </div>
      </div>

      {/* 相册网格 */}
      {albums.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              selectionMode={selectionMode}
              isSelected={selectedAlbums.has(album.id)}
              onToggleSelection={() => toggleSelection(album.id)}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteAlbum}
              isDuplicating={duplicatingId === album.id}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      ) : (
        /* 空状态 */
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">还没有相册</h2>
          <p className="text-text-secondary mb-6">
            创建您的第一个相册开始分享照片
          </p>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            新建相册
          </button>
        </div>
      )}

      {/* 创建相册对话框 */}
      <CreateAlbumDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}

function AlbumCard({
  album,
  selectionMode,
  isSelected,
  onToggleSelection,
  onDuplicate,
  onDelete,
  isDuplicating,
  isDeleting,
}: {
  album: AlbumWithCover
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelection?: () => void
  onDuplicate?: (albumId: string, e: React.MouseEvent) => void
  onDelete?: (albumId: string, e: React.MouseEvent) => void
  isDuplicating?: boolean
  isDeleting?: boolean
}) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
  const coverUrl = album.cover_thumb_key
    ? `${mediaUrl}/${album.cover_thumb_key}`
    : album.cover_photo_id
    ? `${mediaUrl}/thumbs/${album.id}/${album.cover_photo_id}.jpg`
    : null

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
      e.preventDefault()
      onToggleSelection()
    }
  }

  const CardContent = (
    <div
      className={cn(
        'card group transition-all',
        selectionMode ? 'cursor-pointer' : 'hover:border-border-light',
        isSelected && 'ring-2 ring-accent'
      )}
      onClick={handleClick}
    >
      {/* 选择指示器 */}
      {selectionMode && (
        <div
          className={cn(
            'absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-accent border-accent'
              : 'border-white/50 bg-black/30'
          )}
        >
          {isSelected && <Check className="w-4 h-4 text-background" />}
        </div>
      )}

      {/* 封面图 */}
      <div className="aspect-[4/3] bg-surface rounded-lg mb-4 overflow-hidden relative">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={album.title}
            fill
            className={cn(
              'object-cover transition-transform duration-300',
              !selectionMode && 'group-hover:scale-105'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen className="w-12 h-12 text-text-muted" />
          </div>
        )}
      </div>

      {/* 操作按钮（悬停显示） */}
      {!selectionMode && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
          <button
            onClick={(e) => onDuplicate?.(album.id, e)}
            disabled={isDuplicating}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors disabled:opacity-50 backdrop-blur-sm"
            title="复制相册配置"
          >
            {isDuplicating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => onDelete?.(album.id, e)}
            disabled={isDeleting}
            className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-colors disabled:opacity-50 backdrop-blur-sm"
            title="删除相册"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* 相册信息 */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-lg mb-1 group-hover:text-accent transition-colors">
            {album.title}
          </h3>
          <div className="space-y-1">
            <p className="text-text-secondary text-sm">
              {album.photo_count} 张照片
            </p>
            {(album as any).event_date && (
              <p className="text-text-muted text-xs">
                活动时间：{new Date((album as any).event_date).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            {(album as any).location && (
              <p className="text-text-muted text-xs">
                地点：{(album as any).location}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full ${
              album.is_public
                ? 'bg-green-500/10 text-green-400'
                : 'bg-surface text-text-muted'
            }`}
          >
            {album.is_public ? '公开' : '私有'}
          </span>
          <p className="text-text-muted text-xs mt-2">
            {formatRelativeTime(album.created_at)}
          </p>
        </div>
      </div>
    </div>
  )

  if (selectionMode) {
    return CardContent
  }

  return <Link href={`/admin/albums/${album.id}`}>{CardContent}</Link>
}
