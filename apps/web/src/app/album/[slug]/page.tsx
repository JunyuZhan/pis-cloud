import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlbumClient } from '@/components/album/album-client'
import { AlbumHero } from '@/components/album/album-hero'
import { AlbumInfoBar } from '@/components/album/album-info-bar'
import { AlbumStickyNav } from '@/components/album/album-sticky-nav'
import { AlbumFooter } from '@/components/album/album-footer'
import { type SortRule } from '@/components/album/sort-toggle'
import { type LayoutMode } from '@/components/album/layout-toggle'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

interface AlbumPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; layout?: string }>
}

/**
 * 访客相册浏览页 - 沉浸式活动主页
 */
export default async function AlbumPage({ params, searchParams }: AlbumPageProps) {
  const { slug } = await params
  const { sort, layout } = await searchParams
  const supabase = await createClient()

  // 获取相册信息
  const { data: albumData, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (albumError || !albumData) {
    notFound()
  }

  const album = albumData as Album
  
  // 确定排序和布局规则
  const currentSort = (sort as SortRule) || album.sort_rule || 'capture_desc'
  const currentLayout = (layout as LayoutMode) || album.layout || 'masonry'
  
  let orderBy = 'captured_at'
  let ascending = false

  if (currentSort === 'capture_asc') {
    ascending = true
  } else if (currentSort === 'upload_desc') {
    orderBy = 'created_at'
  }

  // 获取照片列表
  const { data: photosData } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', album.id)
    .eq('status', 'completed')
    .order(orderBy, { ascending })
    .limit(20)

  const photos = (photosData || []) as Photo[]

  // 获取封面照片（优先使用设置的封面，否则用第一张）
  let coverPhoto: Photo | null = null
  if (album.cover_photo_id) {
    const { data: cover } = await supabase
      .from('photos')
      .select('*')
      .eq('id', album.cover_photo_id)
      .single()
    coverPhoto = cover as Photo | null
  }
  if (!coverPhoto && photos.length > 0) {
    coverPhoto = photos[0]
  }

  return (
    <main className="min-h-screen bg-background">
      {/* 沉浸式封面 Banner */}
      <AlbumHero album={album} coverPhoto={coverPhoto} />

      {/* 品牌信息栏 */}
      <AlbumInfoBar album={album} />

      {/* 吸顶导航栏（滚动后显示） */}
      <AlbumStickyNav 
        album={album} 
        currentSort={currentSort} 
        currentLayout={currentLayout}
        threshold={400}
      />

      {/* 照片网格 */}
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* 照片统计栏 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <h2 className="text-lg font-medium">
            全部照片 <span className="text-text-muted">({album.photo_count})</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* 这里保留原来的排序和布局切换，但只在非吸顶状态显示 */}
          </div>
        </div>

        {/* 照片列表 */}
        <AlbumClient album={album} initialPhotos={photos || []} layout={currentLayout} />
      </div>

      {/* 底部版权栏 */}
      <AlbumFooter album={album} />
    </main>
  )
}
