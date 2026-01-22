import Link from 'next/link'
import Image from 'next/image'
import { Camera, FolderOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']

/**
 * 公开相册广场首页
 */
export default async function HomePage() {
  const supabase = await createClient()
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

  // 获取公开相册列表
  const { data } = await supabase
    .from('albums')
    .select('*')
    .eq('is_public', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const albums = data as Album[] | null

  return (
    <main className="min-h-screen bg-background">
      {/* 头部导航 */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Camera className="w-8 h-8 text-accent" />
            <span className="text-xl font-serif font-bold">PIS</span>
          </Link>
          <Link href="/admin" className="btn-ghost text-sm" prefetch={false}>
            管理后台
          </Link>
        </div>
      </header>

      {/* 主要内容区 */}
      <div className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* 标题区 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              摄影作品集
            </h1>
            <p className="text-text-secondary text-lg">
              精选公开相册，展示专业摄影作品
            </p>
          </div>

          {/* 相册网格 */}
          {albums && albums.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map((album) => (
                <Link
                  key={album.id}
                  href={`/album/${album.slug}`}
                  className="card group cursor-pointer hover:border-border-light transition-all block"
                >
                  <div className="aspect-[4/3] bg-surface rounded-lg mb-4 overflow-hidden relative">
                    {album.cover_photo_id ? (
                      <Image
                        src={`${mediaUrl}/processed/thumbs/${album.id}/${album.cover_photo_id}.jpg`}
                        alt={album.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
                        <FolderOpen className="w-12 h-12 text-text-muted" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-lg mb-1 group-hover:text-accent transition-colors">
                    {album.title}
                  </h3>
                  <p className="text-text-secondary text-sm">
                    {album.photo_count} 张照片
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            /* 空状态 */
            <div className="text-center py-20">
              <Camera className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">暂无公开相册</h2>
              <p className="text-text-secondary">
                管理员还没有公开任何相册
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
