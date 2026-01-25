import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { HomeHeader } from '@/components/home/header'
import { HomeHero } from '@/components/home/home-hero'
import { AlbumGrid } from '@/components/home/album-grid'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

/**
 * 公开相册广场首页 - 专业摄影师作品集
 * 使用ISR（增量静态再生）优化性能，每60秒重新生成
 */
export const revalidate = 60 // ISR: 60秒重新验证

export default async function HomePage() {
  const t = await getTranslations('home')
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

  // 所有相册都在作品集区域展示
  const otherAlbums = albums

  // 优化：批量获取所有相册的封面照片，减少N+1查询
  const albumsWithCoverKeys = await (async () => {
    if (!otherAlbums || otherAlbums.length === 0) return []
    
    // 收集所有需要查询的封面照片ID
    const coverPhotoIds = otherAlbums
      .map(album => album.cover_photo_id)
      .filter((id): id is string => !!id)
    
    // 批量获取封面照片
    const { data: coverPhotos } = coverPhotoIds.length > 0
      ? await supabase
          .from('photos')
          .select('id, thumb_key, preview_key, status')
          .in('id', coverPhotoIds)
          .eq('status', 'completed')
      : { data: [] }
    
    // 创建封面照片映射
    const coverMap = new Map(
      (coverPhotos || []).map(photo => [
        photo.id,
        { thumb_key: photo.thumb_key, preview_key: photo.preview_key }
      ])
    )
    
    // 收集需要获取第一张照片的相册ID
    const albumsNeedingFirstPhoto = otherAlbums.filter(
      album => !album.cover_photo_id || !coverMap.has(album.cover_photo_id)
    )
    
    // 批量获取第一张照片（只查询需要的相册）
    const albumIdsNeedingPhoto = albumsNeedingFirstPhoto.map(a => a.id)
    const { data: firstPhotos } = albumIdsNeedingPhoto.length > 0
      ? await supabase
          .from('photos')
          .select('album_id, thumb_key, preview_key')
          .in('album_id', albumIdsNeedingPhoto)
          .eq('status', 'completed')
          .not('thumb_key', 'is', null)
          .order('captured_at', { ascending: false })
      : { data: [] }
    
    // 为每个相册创建第一张照片映射（每个相册只取第一张）
    const firstPhotoMap = new Map<string, { thumb_key: string | null; preview_key: string | null }>()
    if (firstPhotos) {
      const seenAlbums = new Set<string>()
      for (const photo of firstPhotos) {
        if (!seenAlbums.has(photo.album_id)) {
          firstPhotoMap.set(photo.album_id, {
            thumb_key: photo.thumb_key,
            preview_key: photo.preview_key
          })
          seenAlbums.add(photo.album_id)
        }
      }
    }
    
    // 批量获取每个相册的实际照片数量
    const albumIds = otherAlbums.map(a => a.id)
    const photoCountMap = new Map<string, number>()
    
    // 分批查询每个相册的照片数量
    await Promise.all(
      albumIds.map(async (albumId) => {
        const { count } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', albumId)
          .eq('status', 'completed')
        photoCountMap.set(albumId, count || 0)
      })
    )
    
    // 组合结果
    return otherAlbums.map(album => {
      let coverThumbKey: string | null = null
      let coverPreviewKey: string | null = null
      
      if (album.cover_photo_id) {
        const cover = coverMap.get(album.cover_photo_id)
        if (cover) {
          coverThumbKey = cover.thumb_key
          coverPreviewKey = cover.preview_key
        }
      }
      
      if (!coverThumbKey && !coverPreviewKey) {
        const firstPhoto = firstPhotoMap.get(album.id)
        if (firstPhoto) {
          coverThumbKey = firstPhoto.thumb_key
          coverPreviewKey = firstPhoto.preview_key
        }
      }
      
      return {
        ...album,
        photo_count: photoCountMap.get(album.id) ?? album.photo_count,
        cover_thumb_key: coverThumbKey,
        cover_preview_key: coverPreviewKey,
      }
    })
  })()

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
                {t('works')}
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
              {t('moreComing')}
            </p>
          </div>
        </section>
      ) : (
        // 空状态
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <Camera className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('noAlbums')}</h2>
            <p className="text-text-secondary">
              {t('noAlbumsDesc')}
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
