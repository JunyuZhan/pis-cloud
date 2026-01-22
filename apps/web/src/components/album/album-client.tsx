'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { MasonryGrid } from './masonry'
import { Loader2 } from 'lucide-react'
import type { Album, Photo } from '@/types/database'
import type { LayoutMode } from './layout-toggle'

interface AlbumClientProps {
  album: Album
  initialPhotos: Photo[]
  layout?: LayoutMode
}

interface PhotosResponse {
  photos: Photo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 相册客户端组件
 * 负责：无限滚动加载更多照片
 * 排序由页面 header 的 SortToggle 通过 URL 参数控制
 */
export function AlbumClient({ album, initialPhotos, layout = 'masonry' }: AlbumClientProps) {
  const searchParams = useSearchParams()
  const sort = searchParams.get('sort') || album.sort_rule || 'capture_desc'

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['album-photos', album.slug, sort],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `/api/public/albums/${album.slug}/photos?page=${pageParam}&limit=20&sort=${sort}`
      )
      if (!res.ok) throw new Error('Failed to fetch photos')
      return res.json() as Promise<PhotosResponse>
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination
      return page < totalPages ? page + 1 : undefined
    },
    initialData: {
      pages: [
        {
          photos: initialPhotos,
          pagination: {
            page: 1,
            limit: 20,
            total: album.photo_count,
            totalPages: Math.ceil(album.photo_count / 20),
          },
        },
      ],
      pageParams: [1],
    },
    staleTime: 30 * 1000,
  })

  // 展平所有页面的照片
  const allPhotos = data?.pages.flatMap((page) => page.photos) || initialPhotos

  return (
    <>
      {/* 照片网格 */}
      {isLoading && allPhotos.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
        </div>
      ) : allPhotos.length > 0 ? (
        <MasonryGrid
          photos={allPhotos}
          album={album}
          layout={layout}
          hasMore={hasNextPage}
          isLoading={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      ) : (
        <div className="text-center py-20">
          <p className="text-text-secondary">暂无照片</p>
        </div>
      )}
    </>
  )
}
