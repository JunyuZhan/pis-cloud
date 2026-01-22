import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AlbumDetailClient } from '@/components/admin/album-detail-client'
import { ShareLinkButton } from '@/components/admin/share-link-button'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * 相册详情页 - 照片管理
 */
export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 获取相册信息
  const { data: albumData, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (albumError || !albumData) {
    notFound()
  }

  const album = albumData as Album

  // 获取照片列表
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', id)
    .eq('status', 'completed')
    .order('sort_order', { ascending: true })

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/album/${album.slug}`

  return (
    <div>
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-text-secondary mb-6">
        <Link
          href="/admin"
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回相册列表
        </Link>
      </div>

      {/* 页面标题 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold">{album.title}</h1>
          <p className="text-text-secondary mt-1">
            {album.photo_count} 张照片 · {album.is_public ? '公开' : '私有'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 分享链接 */}
          <ShareLinkButton url={shareUrl} albumTitle={album.title} />
          <Link
            href={`/admin/albums/${id}/settings`}
            className="btn-secondary"
          >
            <Settings className="w-4 h-4" />
            设置
          </Link>
        </div>
      </div>

      {/* 客户端组件：上传和照片网格 */}
      <AlbumDetailClient album={album} initialPhotos={photos || []} />
    </div>
  )
}
