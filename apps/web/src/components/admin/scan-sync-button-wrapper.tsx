'use client'

import { ScanSyncButton } from './scan-sync-button'

interface ScanSyncButtonWrapperProps {
  albumId: string
}

export function ScanSyncButtonWrapper({ albumId }: ScanSyncButtonWrapperProps) {
  return <ScanSyncButton albumId={albumId} onComplete={() => window.location.reload()} />
}
