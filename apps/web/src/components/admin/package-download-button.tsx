'use client'

import { useState } from 'react'
import { Download, Loader2, Check, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { showError, showInfo } from '@/lib/toast'

interface PackageDownloadButtonProps {
  albumId: string
  photoCount: number
  selectedCount: number
}

export function PackageDownloadButton({
  albumId,
  photoCount,
  selectedCount,
}: PackageDownloadButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [packageId, setPackageId] = useState<string | null>(null)
  const [packageStatus, setPackageStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [photoSelection, setPhotoSelection] = useState<'all' | 'selected' | 'custom'>('selected')
  const [includeWatermarked, setIncludeWatermarked] = useState(true)
  const [includeOriginal, setIncludeOriginal] = useState(true)

  const handleCreatePackage = async () => {
    if (!includeWatermarked && !includeOriginal) {
      showInfo('请至少选择一种版本（有水印或无水印）')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoSelection,
          includeWatermarked,
          includeOriginal,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || '创建打包任务失败')
      }

      const data = await response.json()
      setPackageId(data.packageId)
      setPackageStatus('pending')
      
      // 开始轮询状态
      pollPackageStatus(data.packageId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建打包任务失败'
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const pollPackageStatus = async (id: string) => {
    let pollCount = 0
    const maxPolls = 300 // 最多轮询10分钟（300次 × 2秒）

    const interval = setInterval(async () => {
      pollCount++
      try {
        const response = await fetch(`/api/admin/albums/${albumId}/package?packageId=${id}`)
        if (response.ok) {
          const data = await response.json()
          setPackageStatus(data.status)
          
          if (data.status === 'completed') {
            clearInterval(interval)
            setDownloadUrl(data.download_url)
          } else if (data.status === 'failed') {
            clearInterval(interval)
            showError('打包失败，请重试')
          } else if (pollCount >= maxPolls) {
            clearInterval(interval)
            showError('打包超时，请稍后查看状态或重新创建')
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        if (pollCount >= maxPolls) {
          clearInterval(interval)
        }
      }
    }, 2000) // 每2秒轮询一次
  }

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm min-h-[44px] px-3 sm:px-4"
      >
        <Package className="w-4 h-4" />
        <span className="hidden sm:inline">打包下载</span>
        <span className="sm:hidden">打包</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {!packageId ? (
            <>
              <DialogHeader>
                <DialogTitle>创建打包下载</DialogTitle>
                <DialogDescription>
                  选择要打包的照片和版本，系统将生成 ZIP 文件供下载
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    选择照片
                  </label>
                  <select
                    value={photoSelection}
                    onChange={(e) => setPhotoSelection(e.target.value as 'all' | 'selected' | 'custom')}
                    className="input"
                  >
                    <option value="selected">已选照片 ({selectedCount} 张)</option>
                    <option value="all">全部照片 ({photoCount} 张)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    包含版本
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeWatermarked}
                        onChange={(e) => setIncludeWatermarked(e.target.checked)}
                        className="rounded"
                      />
                      <span>有水印版本</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeOriginal}
                        onChange={(e) => setIncludeOriginal(e.target.checked)}
                        className="rounded"
                      />
                      <span>无水印版本（原图）</span>
                    </label>
                  </div>
                </div>

                <div className="bg-surface p-3 rounded-lg text-sm text-text-muted">
                  <p className="font-medium mb-1">提示：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>打包文件将在15天内有效</li>
                    <li>ZIP 文件包含两个文件夹：有水印 和 无水印</li>
                    <li>处理时间取决于照片数量，请耐心等待</li>
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreatePackage}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      创建打包
                    </>
                  )}
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>打包下载</DialogTitle>
                <DialogDescription>
                  {packageStatus === 'pending' || packageStatus === 'processing'
                    ? '正在处理中，请稍候...'
                    : packageStatus === 'completed'
                    ? '打包完成，可以下载了'
                    : '打包失败'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {packageStatus === 'pending' || packageStatus === 'processing' ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
                    <span className="text-text-secondary mb-2">
                      {packageStatus === 'pending' ? '等待处理...' : '正在打包...'}
                    </span>
                    <p className="text-xs text-text-muted text-center max-w-xs">
                      处理时间取决于照片数量，请耐心等待。完成后会自动显示下载按钮。
                    </p>
                  </div>
                ) : packageStatus === 'completed' ? (
                  <div className="text-center py-4">
                    <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-text-secondary mb-4">
                      打包完成！下载链接将在15天后过期。
                    </p>
                    <button type="button" onClick={handleDownload} className="btn-primary w-full">
                      <Download className="w-4 h-4" />
                      下载 ZIP 文件
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-red-400 mb-4">打包失败，请重试</p>
                    <button
                      onClick={() => {
                        setPackageId(null)
                        setPackageStatus('pending')
                        setDownloadUrl(null)
                      }}
                      className="btn-secondary"
                    >
                      重新创建
                    </button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  关闭
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
