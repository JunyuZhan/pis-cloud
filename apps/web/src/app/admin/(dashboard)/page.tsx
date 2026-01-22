import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AlbumList } from '@/components/admin/album-list'

/**
 * 相册列表页 (管理后台首页)
 */
export default async function AdminPage() {
  const supabase = await createClient()

  // 获取相册列表
  const { data: albumsData } = await supabase
    .from('albums')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // 获取封面图的 key
  const coverPhotoIds = albumsData?.map((a) => a.cover_photo_id).filter(Boolean) || []
  let coverPhotosMap: Record<string, string> = {}

  if (coverPhotoIds.length > 0) {
    const { data: photos } = await supabase
      .from('photos')
      .select('id, thumb_key')
      .in('id', coverPhotoIds)

    if (photos) {
      coverPhotosMap = photos.reduce((acc, photo) => {
        if (photo.thumb_key) {
          acc[photo.id] = photo.thumb_key
        }
        return acc
      }, {} as Record<string, string>)
    }
  }

  const albums = albumsData?.map((album) => ({
    ...album,
    cover_thumb_key: album.cover_photo_id ? coverPhotosMap[album.cover_photo_id] : null,
  })) || []

  return (
    <Suspense fallback={<AlbumListSkeleton />}>
      <AlbumList initialAlbums={albums || []} />
    </Suspense>
  )
}

function AlbumListSkeleton() {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <div className="h-8 w-32 bg-surface-elevated rounded animate-pulse" />
          <div className="h-4 w-48 bg-surface-elevated rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-full md:w-28 bg-surface-elevated rounded-lg animate-pulse" />
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
