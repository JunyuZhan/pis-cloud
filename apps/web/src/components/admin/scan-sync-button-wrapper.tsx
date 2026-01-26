'use client'

import { useRouter } from 'next/navigation'
import { ScanSyncButton } from './scan-sync-button'

interface ScanSyncButtonWrapperProps {
  albumId: string
}

export function ScanSyncButtonWrapper({ albumId }: ScanSyncButtonWrapperProps) {
  const router = useRouter()
  
  const handleComplete = () => {
    router.refresh()
  }
  
  return <ScanSyncButton albumId={albumId} onComplete={handleComplete} />
}
