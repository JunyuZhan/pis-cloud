'use client'

import { useState } from 'react'
import { RefreshCw, FolderSync, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScanSyncButtonProps {
  albumId: string
  onComplete?: () => void
}

export function ScanSyncButton({ albumId, onComplete }: ScanSyncButtonProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    added?: number
  } | null>(null)

  const handleScan = async () => {
    setIsScanning(true)
    setResult(null)

    try {
      const response = await fetch(`/api/admin/albums/${albumId}/scan`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({
          success: false,
          message: data.error?.message || '扫描失败',
        })
        return
      }

      setResult({
        success: true,
        message: data.message,
        added: data.added,
      })

      if (data.added > 0) {
        onComplete?.()
      }
    } catch {
      setResult({
        success: false,
        message: '网络错误，请重试',
      })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleScan}
        disabled={isScanning}
        className={cn(
          'btn-secondary min-h-[44px] px-3 sm:px-4',
          isScanning && 'opacity-50 cursor-not-allowed'
        )}
        title="扫描 MinIO 中的新图片并导入"
      >
        {isScanning ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <FolderSync className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {isScanning ? '扫描中...' : '扫描同步'}
        </span>
      </button>

      {/* 结果提示 */}
      {result && (
        <div
          className={cn(
            'absolute top-full mt-2 right-0 p-3 rounded-lg shadow-lg z-10 min-w-[200px]',
            result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={cn(
              'text-sm',
              result.success ? 'text-green-400' : 'text-red-400'
            )}>
              {result.message}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
