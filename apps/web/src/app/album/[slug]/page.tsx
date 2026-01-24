import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AlbumClient } from '@/components/album/album-client'
import { AlbumHero } from '@/components/album/album-hero'
import { AlbumInfoBar } from '@/components/album/album-info-bar'
import { AlbumStickyNav } from '@/components/album/album-sticky-nav'
import { AlbumShareButton } from '@/components/album/album-share-button'
import { PhotoGroupFilter } from '@/components/album/photo-group-filter'
import { FloatingActions } from '@/components/album/floating-actions'
import { SortToggle, type SortRule } from '@/components/album/sort-toggle'
import { LayoutToggle, type LayoutMode } from '@/components/album/layout-toggle'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

interface AlbumPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; layout?: string; group?: string; from?: string }>
}

/**
 * 生成动态 metadata（用于 Open Graph 和微信分享）
 */
export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: album } = await supabase
    .from('albums')
    .select('title, description, share_title, share_description, share_image_url, cover_photo_id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (!album) {
    return {
      title: '相册不存在',
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/pis-photos'
  
  // 使用自定义分享配置，如果没有则使用默认值
  const shareTitle = (album as any).share_title || album.title
  const shareDescription = (album as any).share_description || album.description || `查看 ${album.title} 的精彩照片`
  
  // 获取分享图片（优先使用自定义图片，否则使用封面图）
  let shareImage = (album as any).share_image_url
  if (!shareImage && album.cover_photo_id) {
    const { data: coverPhoto } = await supabase
      .from('photos')
      .select('preview_key, thumb_key')
      .eq('id', album.cover_photo_id)
      .single()
    
    if (coverPhoto?.preview_key) {
      shareImage = `${mediaUrl}/${coverPhoto.preview_key}`
    } else if (coverPhoto?.thumb_key) {
      shareImage = `${mediaUrl}/${coverPhoto.thumb_key}`
    }
  }
  
  // 如果没有图片，使用默认图片
  if (!shareImage) {
    shareImage = `${appUrl}/og-image.png` // 可以创建一个默认的 OG 图片
  }

  const shareUrl = `${appUrl}/album/${album.slug}`

  return {
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      type: 'website',
      title: shareTitle,
      description: shareDescription,
      url: shareUrl,
      siteName: 'PIS - 专业级摄影分享',
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: album.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [shareImage],
    },
    // 微信分享 meta（通过其他 meta 标签实现）
    other: {
      'weixin:title': shareTitle,
      'weixin:description': shareDescription,
      'weixin:image': shareImage,
      // 额外的 Open Graph 标签
      'og:title': shareTitle,
      'og:description': shareDescription,
      'og:image': shareImage,
      'og:url': shareUrl,
    },
  }
}

/**
 * 访客相册浏览页 - 沉浸式活动主页
 */
export default async function AlbumPage({ params, searchParams }: AlbumPageProps) {
  const { slug } = await params
  const { sort, layout, group, from } = await searchParams
  const supabase = await createClient()

  // 获取相册信息（包含密码和过期时间检查）
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

  // 检查相册是否过期
  if (album.expires_at && new Date(album.expires_at) < new Date()) {
    notFound() // 过期相册返回 404，不暴露过期信息
  }

  // 注意：密码验证应该在客户端组件中处理
  // 如果相册设置了密码，需要在客户端验证后才能显示照片
  
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

  // 获取分组列表（如果相册有分组）
  const { data: groupsData } = await supabase
    .from('photo_groups')
    .select('*')
    .eq('album_id', album.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const groups = groupsData || []

  // 获取照片列表
  const { data: photosData } = await supabase
    .from('photos')
    .select('*')
    .eq('album_id', album.id)
    .eq('status', 'completed')
    .order(orderBy, { ascending })
    .limit(20)

  const photos = (photosData || []) as Photo[]

  // 获取照片分组关联（如果相册有分组）
  let photoGroupMap: Map<string, string[]> = new Map()
  if (groups.length > 0) {
    for (const group of groups) {
      const { data: assignments } = await supabase
        .from('photo_group_assignments')
        .select('photo_id')
        .eq('group_id', group.id)
      
      if (assignments) {
        photoGroupMap.set(group.id, assignments.map(a => a.photo_id))
      }
    }
  }

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
      <AlbumHero album={album} coverPhoto={coverPhoto} from={from} />

      {/* 品牌信息栏 */}
      <AlbumInfoBar album={album} />

      {/* 吸顶导航栏（滚动后显示） */}
      <AlbumStickyNav 
        album={album} 
        currentSort={currentSort} 
        currentLayout={currentLayout}
        threshold={400}
        from={from}
      />

      {/* 照片网格 - 移动端优化 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* 分组筛选器 */}
        {groups.length > 0 && (
          <PhotoGroupFilter
            albumId={album.id}
            albumSlug={album.slug}
            selectedGroupId={group || null}
          />
        )}

        {/* 照片统计栏 - 移动端优化 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-border">
          <h2 className="text-base sm:text-lg font-medium">
            {group ? '分组照片' : '全部照片'} <span className="text-text-muted text-sm sm:text-base">({album.photo_count})</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* 布局切换和排序切换 - 桌面端显示 */}
            <div className="hidden sm:flex items-center gap-2">
              <LayoutToggle currentLayout={currentLayout} />
              <SortToggle currentSort={currentSort} />
            </div>
          </div>
        </div>

        {/* 照片列表 */}
        <AlbumClient album={album} initialPhotos={photos || []} layout={currentLayout} />
      </div>

      {/* 浮动操作按钮组 */}
      <FloatingActions album={album} currentSort={currentSort} />
    </main>
  )
}
