'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

// 格式化网速
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
  }
  return `${bytesPerSecond.toFixed(0)} B/s`
}

interface PhotoUploaderProps {
  albumId: string
  onComplete?: () => void
}

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  speed?: number // bytes per second
  error?: string
}

export function PhotoUploader({ albumId, onComplete }: PhotoUploaderProps) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const validFiles = fileArray.filter((file) => {
      const isValidType = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'].includes(
        file.type
      )
      const isValidSize = file.size <= 100 * 1024 * 1024 // 100MB
      return isValidType && isValidSize
    })

    const uploadFiles: UploadFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }))

    setFiles((prev) => [...prev, ...uploadFiles])

    // 开始上传
    uploadFiles.forEach((uploadFile) => {
      uploadSingleFile(uploadFile)
    })
  }, [albumId])

  const uploadSingleFile = async (uploadFile: UploadFile) => {
    try {
      // 更新状态为上传中
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        )
      )

      // 1. 获取上传凭证
      const credRes = await fetch(`/api/admin/albums/${albumId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
          fileSize: uploadFile.file.size,
        }),
      })

      if (!credRes.ok) {
        throw new Error('获取上传凭证失败')
      }

      const { photoId, uploadUrl, originalKey, albumId: respAlbumId } = await credRes.json()

      // 2. 使用 XMLHttpRequest 上传以获取进度
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const startTime = Date.now()
        let lastLoaded = 0
        let lastTime = startTime
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            const now = Date.now()
            const timeDiff = (now - lastTime) / 1000 // seconds
            
            // 计算瞬时速度 (每 200ms 更新一次)
            let speed = 0
            if (timeDiff >= 0.2) {
              const bytesDiff = event.loaded - lastLoaded
              speed = bytesDiff / timeDiff
              lastLoaded = event.loaded
              lastTime = now
            }
            
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id 
                  ? { ...f, progress, ...(speed > 0 ? { speed } : {}) } 
                  : f
              )
            )
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error('上传失败'))
          }
        }

        xhr.onerror = () => reject(new Error('网络错误'))
        xhr.ontimeout = () => reject(new Error('上传超时'))

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', uploadFile.file.type)
        xhr.send(uploadFile.file)
      })

      // 3. 通知后端触发处理
      await fetch('/api/admin/photos/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
      })

      // 更新状态为完成
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        )
      )

      // 刷新页面数据
      router.refresh()
    } catch (err) {
      // 更新状态为失败
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'failed' as const,
                error: err instanceof Error ? err.message : '上传失败',
              }
            : f
        )
      )
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const completedCount = files.filter((f) => f.status === 'completed').length
  const uploadingCount = files.filter((f) => f.status === 'uploading').length

  return (
    <div className="space-y-4">
      {/* 拖拽区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 md:p-8 text-center transition-colors',
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-border-light'
        )}
      >
        <input
          type="file"
          id="file-input"
          multiple
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <Upload className="w-10 h-10 md:w-12 md:h-12 text-text-muted mx-auto mb-3 md:mb-4" />
          <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
            点击选择文件<span className="hidden md:inline">，或拖拽照片到此处</span>
          </p>
          <p className="text-text-secondary text-xs md:text-sm">
            支持 JPG、PNG、HEIC、WebP 格式，单文件最大 100MB
          </p>
        </label>
      </div>

      {/* 上传进度 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {uploadingCount > 0
                ? `正在上传 ${uploadingCount} 个文件...`
                : `已完成 ${completedCount}/${files.length}`}
            </span>
            {completedCount === files.length && files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="text-text-muted hover:text-text-primary"
              >
                清空列表
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-surface rounded-lg"
              >
                {/* 状态图标 */}
                <div className="shrink-0">
                  {file.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {file.status === 'failed' && (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  {file.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-text-muted" />
                  )}
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    {file.status === 'uploading' && (
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs text-accent">{file.progress}%</span>
                        {file.speed && (
                          <span className="text-xs text-text-muted">{formatSpeed(file.speed)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {file.status === 'uploading' ? (
                    <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300 ease-out"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {formatFileSize(file.file.size)}
                      {file.error && (
                        <span className="text-red-400 ml-2">{file.error}</span>
                      )}
                    </p>
                  )}
                </div>

                {/* 移除按钮 */}
                {file.status !== 'uploading' && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="shrink-0 p-1 text-text-muted hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
