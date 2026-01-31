'use client'

import { ShareLinkButton } from '@/components/admin/share-link-button'
import { getAlbumShareUrl } from '@/lib/utils'
import { getAppBaseUrl } from '@/lib/utils'

interface AlbumShareButtonProps {
  albumSlug: string
  albumTitle: string
  albumDescription?: string | null
  backgroundImageUrl?: string | null
}

export function AlbumShareButton({ 
  albumSlug, 
  albumTitle,
  albumDescription,
  backgroundImageUrl,
}: AlbumShareButtonProps) {
  // 添加错误处理，防止无效slug导致组件崩溃
  let shareUrl: string
  try {
    shareUrl = getAlbumShareUrl(albumSlug)
  } catch (error) {
    // 如果slug无效，使用默认URL
    console.error('Invalid album slug:', error)
    const baseUrl = getAppBaseUrl()
    shareUrl = `${baseUrl}/album/${encodeURIComponent(albumSlug || '')}`
  }

  return (
    <div className="relative inline-block">
      <ShareLinkButton 
        url={shareUrl} 
        albumTitle={albumTitle}
        albumDescription={albumDescription}
        backgroundImageUrl={backgroundImageUrl}
      />
    </div>
  )
}
