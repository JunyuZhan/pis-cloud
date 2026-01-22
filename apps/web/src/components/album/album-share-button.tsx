'use client'

import { ShareLinkButton } from '@/components/admin/share-link-button'
import { Share2 } from 'lucide-react'

interface AlbumShareButtonProps {
  albumSlug: string
  albumTitle: string
}

export function AlbumShareButton({ albumSlug, albumTitle }: AlbumShareButtonProps) {
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/album/${albumSlug}`
    : `/album/${albumSlug}`

  return (
    <div className="relative inline-block">
      <ShareLinkButton url={shareUrl} albumTitle={albumTitle} />
    </div>
  )
}
