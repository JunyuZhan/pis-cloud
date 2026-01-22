import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlbumClient } from '@/components/album/album-client'
import { AlbumHeader } from '@/components/album/album-header'
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
 * 访客相册浏览页
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

  // 获取第一页照片
  const { data: photosData } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', album.id)
    .eq('status', 'completed')
    .order(orderBy, { ascending })
    .limit(20)

  const photos = (photosData || []) as Photo[]

  return (
    <main className="min-h-screen bg-background">
      {/* 头部 (响应式组件) */}
      <AlbumHeader 
        album={album} 
        currentSort={currentSort} 
        currentLayout={currentLayout} 
      />

      {/* 照片网格 (客户端组件接管无限滚动) */}
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
        <AlbumClient album={album} initialPhotos={photos || []} layout={currentLayout} />
      </div>
    </main>
  )
}
