import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AlbumList } from '@/components/admin/album-list'

/**
 * 相册列表页 (管理后台首页)
 */
export default async function AdminPage() {
  const supabase = await createClient()

  // 获取相册列表
  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <Suspense fallback={<AlbumListSkeleton />}>
      <AlbumList initialAlbums={albums || []} />
    </Suspense>
  )
}

function AlbumListSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-32 bg-surface-elevated rounded animate-pulse" />
          <div className="h-4 w-48 bg-surface-elevated rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-28 bg-surface-elevated rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card">
            <div className="aspect-[4/3] bg-surface rounded-lg mb-4 animate-pulse" />
            <div className="h-5 w-32 bg-surface-elevated rounded animate-pulse mb-2" />
            <div className="h-4 w-20 bg-surface-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
