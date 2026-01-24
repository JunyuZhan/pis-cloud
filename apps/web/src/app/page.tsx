import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HomeHeader } from '@/components/home/header'
import { HomeHero } from '@/components/home/home-hero'
import { AlbumGrid } from '@/components/home/album-grid'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

/**
 * 公开相册广场首页 - 专业摄影师作品集
 */
export default async function HomePage() {
  const supabase = await createClient()

  // 获取公开相册列表
  const { data } = await supabase
    .from('albums')
    .select('*')
    .eq('is_public', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const albums = data as Album[] | null

  // 获取最新相册作为Hero特色展示
  let featuredAlbum: Album | null = null
  let coverPhoto: Photo | null = null

  if (albums && albums.length > 0) {
    featuredAlbum = albums[0]
    
    // 获取封面照片
    if (featuredAlbum.cover_photo_id) {
      const { data: cover } = await supabase
        .from('photos')
        .select('*')
        .eq('id', featuredAlbum.cover_photo_id)
        .single()
      coverPhoto = cover as Photo | null
    }
    
    // 如果没有封面，获取第一张照片
    if (!coverPhoto && featuredAlbum.id) {
      const { data: firstPhoto } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', featuredAlbum.id)
        .eq('status', 'completed')
        .order('captured_at', { ascending: false })
        .limit(1)
        .single()
      coverPhoto = firstPhoto as Photo | null
    }
  }

  // 其他相册（排除第一个，因为已经在Hero中展示）
  const otherAlbums = albums && albums.length > 1 ? albums.slice(1) : albums

  // 为每个相册获取封面照片的 key（用于首页网格显示）
  const albumsWithCoverKeys = await Promise.all(
    (otherAlbums || []).map(async (album) => {
      let coverThumbKey: string | null = null
      let coverPreviewKey: string | null = null

      if (album.cover_photo_id) {
        const { data: cover } = await supabase
          .from('photos')
          .select('thumb_key, preview_key, status')
          .eq('id', album.cover_photo_id)
          .maybeSingle()  // 使用 maybeSingle 避免没有数据时报错
        
        // 只使用已处理完成的照片
        if (cover && cover.status === 'completed' && (cover.thumb_key || cover.preview_key)) {
          coverThumbKey = cover.thumb_key
          coverPreviewKey = cover.preview_key
        }
      }

      // 如果没有封面，获取第一张照片
      if (!coverThumbKey && !coverPreviewKey && album.id) {
        const { data: firstPhoto } = await supabase
          .from('photos')
          .select('thumb_key, preview_key')
          .eq('album_id', album.id)
          .eq('status', 'completed')
          .not('thumb_key', 'is', null)  // 确保 thumb_key 不为空
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle()  // 使用 maybeSingle 避免没有数据时报错
        
        if (firstPhoto && (firstPhoto.thumb_key || firstPhoto.preview_key)) {
          coverThumbKey = firstPhoto.thumb_key
          coverPreviewKey = firstPhoto.preview_key
        }
      }

      return {
        ...album,
        cover_thumb_key: coverThumbKey,
        cover_preview_key: coverPreviewKey,
      }
    })
  )

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* 头部导航 */}
      <HomeHeader />

      {/* Hero区域 - 全屏视觉冲击 */}
      <HomeHero featuredAlbum={featuredAlbum || undefined} coverPhoto={coverPhoto || undefined} />

      {/* 作品展示区 - Instagram风格 */}
      {otherAlbums && otherAlbums.length > 0 ? (
        <section id="works" className="py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            {/* 极简标题 */}
            <div className="mb-4 sm:mb-6 text-center">
              <h2 className="text-sm sm:text-base md:text-lg font-medium text-text-secondary">
                作品集
              </h2>
            </div>

            {/* 相册网格 - 全宽无缝布局 */}
            <AlbumGrid albums={albumsWithCoverKeys} />
          </div>
        </section>
      ) : featuredAlbum ? (
        // 如果只有一个相册，显示提示
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-text-secondary text-lg">
              查看更多精彩作品即将上线
            </p>
          </div>
        </section>
      ) : (
        // 空状态
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <Camera className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">暂无公开相册</h2>
            <p className="text-text-secondary">
              管理员还没有公开任何相册
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
