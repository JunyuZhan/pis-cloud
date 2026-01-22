'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, FolderOpen } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { CreateAlbumDialog } from './create-album-dialog'
import type { Album } from '@/types/database'

interface AlbumListProps {
  initialAlbums: Album[]
}

export function AlbumList({ initialAlbums }: AlbumListProps) {
  const [albums] = useState(initialAlbums)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

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
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="btn-primary w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          新建相册
        </button>
      </div>

      {/* 相册网格 */}
      {albums.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
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

function AlbumCard({ album }: { album: Album }) {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  return (
    <Link
      href={`/admin/albums/${album.id}`}
      className="card group hover:border-border-light transition-all"
    >
      {/* 封面图 */}
      <div className="aspect-[4/3] bg-surface rounded-lg mb-4 overflow-hidden relative">
        {album.cover_photo_id ? (
          <Image
            src={`${mediaUrl}/thumbs/${album.id}/${album.cover_photo_id}.jpg`}
            alt={album.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen className="w-12 h-12 text-text-muted" />
          </div>
        )}
      </div>

      {/* 相册信息 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-lg mb-1 group-hover:text-accent transition-colors">
            {album.title}
          </h3>
          <p className="text-text-secondary text-sm">
            {album.photo_count} 张照片
          </p>
        </div>
        <div className="text-right">
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
    </Link>
  )
}
