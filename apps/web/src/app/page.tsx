import Link from 'next/link'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
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

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* 头部导航 - 浮动透明 */}
      <header className="fixed top-4 left-4 right-4 z-50 glass rounded-2xl max-w-7xl mx-auto">
        <div className="px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <Camera className="w-6 h-6 text-accent" />
            <span className="text-lg font-serif font-bold">PIS</span>
          </Link>
          <Link href="/admin" className="btn-ghost text-sm cursor-pointer" prefetch={false}>
            管理后台
          </Link>
        </div>
      </header>

      {/* Hero区域 - 全屏视觉冲击 */}
      <HomeHero featuredAlbum={featuredAlbum || undefined} coverPhoto={coverPhoto || undefined} />

      {/* 作品展示区 */}
      {otherAlbums && otherAlbums.length > 0 ? (
        <section id="works" className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            {/* 区域标题 */}
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
                精选作品
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                探索更多精彩瞬间，每一张照片都承载着独特的故事
              </p>
            </div>

            {/* Masonry网格 */}
            <AlbumGrid albums={otherAlbums} />
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

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-text-muted text-sm">
            © {new Date().getFullYear()} PIS Photography. 专业级摄影分享系统
          </p>
        </div>
      </footer>
    </main>
  )
}
