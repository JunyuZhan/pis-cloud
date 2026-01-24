import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AlbumDetailClient } from '@/components/admin/album-detail-client'
import { ShareLinkButton } from '@/components/admin/share-link-button'
import { PackageDownloadButton } from '@/components/admin/package-download-button'
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

  // 获取照片列表，同时统计数量
  const { data: photos, count: actualPhotoCount } = await supabase
    .from('photos')
    .select('*', { count: 'exact' })
    .eq('album_id', id)
    .eq('status', 'completed')
    .order('sort_order', { ascending: true })

  // 如果实际照片数量与存储的不一致，更新数据库
  const photoCount = actualPhotoCount ?? 0
  if (photoCount !== albumData.photo_count) {
    await supabase
      .from('albums')
      .update({ photo_count: photoCount })
      .eq('id', id)
  }

  const album = {
    ...albumData,
    photo_count: photoCount,
  } as Album

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

      {/* 页面标题 - 移动端优化 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">{album.title}</h1>
          <p className="text-text-secondary mt-1 text-sm sm:text-base">
            {album.photo_count} 张照片 · {album.is_public ? '公开' : '私有'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* 打包下载 */}
          <PackageDownloadButton
            albumId={id}
            photoCount={album.photo_count}
            selectedCount={album.selected_count || 0}
          />
          {/* 分享链接 */}
          <ShareLinkButton url={shareUrl} albumTitle={album.title} />
          <Link
            href={`/admin/albums/${id}/settings`}
            className="btn-secondary min-h-[44px] px-3 sm:px-4"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">设置</span>
          </Link>
        </div>
      </div>

      {/* 客户端组件：上传和照片网格 */}
      <AlbumDetailClient album={album} initialPhotos={photos || []} />
    </div>
  )
}
