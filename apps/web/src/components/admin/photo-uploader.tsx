'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, RefreshCw, Pause, Play } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

// 上传配置
const PRESIGN_THRESHOLD = 4 * 1024 * 1024 // 4MB 以上直接上传到 Worker
const MAX_CONCURRENT_UPLOADS = 3 // 最大同时上传数量
// MAX_RETRIES removed as it's not used

// 根据文件大小计算超时时间（毫秒）
// 基础超时：10分钟，每MB增加5秒，最大30分钟
function calculateTimeout(fileSize: number): number {
  const baseTimeout = 10 * 60 * 1000 // 10分钟
  const perMbTimeout = 5 * 1000 // 每MB 5秒
  const maxTimeout = 30 * 60 * 1000 // 30分钟
  const fileSizeMb = fileSize / (1024 * 1024)
  const timeout = baseTimeout + fileSizeMb * perMbTimeout
  return Math.min(timeout, maxTimeout)
}

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
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  progress: number
  speed?: number // bytes per second
  error?: string
  originalKey?: string
  photoId?: string
  uploadUrl?: string
  respAlbumId?: string
}

export function PhotoUploader({ albumId }: PhotoUploaderProps) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const completedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map())
  const uploadQueueRef = useRef<string[]>([]) // 等待上传的文件 ID 队列
  const isProcessingQueueRef = useRef(false)

  // 自动移除已完成的上传项（延迟2秒后移除，让用户看到成功反馈）
  useEffect(() => {
    files.forEach((file) => {
      if (file.status === 'completed') {
        // 如果还没有设置定时器，则设置一个
        if (!completedTimersRef.current.has(file.id)) {
          const timer = setTimeout(() => {
            setFiles((prev) => prev.filter((f) => f.id !== file.id))
            completedTimersRef.current.delete(file.id)
          }, 2000) // 2秒后移除
          completedTimersRef.current.set(file.id, timer)
        }
      } else {
        // 如果文件状态不再是 completed，清理对应的定时器
        if (completedTimersRef.current.has(file.id)) {
          clearTimeout(completedTimersRef.current.get(file.id)!)
          completedTimersRef.current.delete(file.id)
        }
      }
    })
  }, [files])

  // 组件卸载时清理所有定时器
  useEffect(() => {
    const timers = completedTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // 处理上传队列
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current) return
    isProcessingQueueRef.current = true

    setFiles(currentFiles => {
      const uploadingCount = currentFiles.filter(f => f.status === 'uploading').length
      const availableSlots = MAX_CONCURRENT_UPLOADS - uploadingCount

      if (availableSlots > 0 && uploadQueueRef.current.length > 0) {
        const toStart = uploadQueueRef.current.splice(0, availableSlots)
        toStart.forEach(fileId => {
          const file = currentFiles.find(f => f.id === fileId)
          if (file && file.status === 'pending') {
            uploadSingleFile(file)
          }
        })
      }

      isProcessingQueueRef.current = false
      return currentFiles
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    // 将新文件加入队列
    uploadQueueRef.current.push(...uploadFiles.map(f => f.id))
    setFiles((prev) => [...prev, ...uploadFiles])

    // 开始处理队列
    setTimeout(processQueue, 0)
  }, [processQueue])

  // getWorkerUrl removed as it's not used

  // 大文件直接上传到 Worker（Worker 没有大小限制）
  const uploadToWorkerDirectly = async (
    uploadFile: UploadFile,
    photoId: string,
    originalKey: string,
    respAlbumId: string
  ) => {
    let lastLoaded = 0
    let lastTime = Date.now()
    let uploadStartTime = Date.now()

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrMapRef.current.set(uploadFile.id, xhr) // 保存 XHR 引用
      
      // 设置超时时间（根据文件大小动态计算）
      const timeout = calculateTimeout(uploadFile.file.size)
      xhr.timeout = timeout
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000
          
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
        xhrMapRef.current.delete(uploadFile.id)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          const errorText = xhr.responseText || ''
          let errorMessage = `上传失败: HTTP ${xhr.status}`
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error) {
              errorMessage = errorData.error.message || errorData.error || errorMessage
            }
          } catch {
            // 忽略解析错误，使用默认消息
          }
          reject(new Error(errorMessage))
        }
      }

      xhr.onerror = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const elapsed = (Date.now() - uploadStartTime) / 1000
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        reject(new Error(`网络错误：文件上传中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒）。请检查网络连接或 Worker 服务状态`))
      }
      
      xhr.onabort = () => {
        xhrMapRef.current.delete(uploadFile.id)
        // 暂停时不 reject，让 promise 保持 pending
      }
      
      xhr.ontimeout = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const elapsed = (Date.now() - uploadStartTime) / 1000
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        const timeoutMinutes = Math.round(timeout / 60000)
        reject(new Error(`上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`))
      }

      const workerDirectUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://worker.albertzhan.top'
      xhr.open('PUT', `${workerDirectUrl}/api/upload?key=${encodeURIComponent(originalKey)}`)
      xhr.setRequestHeader('Content-Type', uploadFile.file.type)
      uploadStartTime = Date.now()
      xhr.send(uploadFile.file)
    })

    // 触发处理（不阻塞，异步执行）
    fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    }).catch((err) => {
      console.error('Failed to trigger photo processing:', err)
      // 不阻断流程，Worker 可以通过定时任务补偿
    })
  }

  // 小文件直接上传
  const uploadDirectly = async (
    uploadFile: UploadFile,
    photoId: string,
    uploadUrl: string,
    originalKey: string,
    respAlbumId: string
  ) => {
    let lastLoaded = 0
    let lastTime = Date.now()
    let uploadStartTime = Date.now()

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrMapRef.current.set(uploadFile.id, xhr) // 保存 XHR 引用
      
      // 设置超时时间（根据文件大小动态计算）
      const timeout = calculateTimeout(uploadFile.file.size)
      xhr.timeout = timeout
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000
          
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
        xhrMapRef.current.delete(uploadFile.id)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          const errorText = xhr.responseText || ''
          let errorMessage = `上传失败: HTTP ${xhr.status}`
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error) {
              errorMessage = errorData.error.message || errorData.error || errorMessage
            }
          } catch {
            // 忽略解析错误，使用默认消息
          }
          reject(new Error(errorMessage))
        }
      }

      xhr.onerror = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const elapsed = (Date.now() - uploadStartTime) / 1000
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        reject(new Error(`网络错误：文件上传中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒）。请检查网络连接`))
      }
      
      xhr.onabort = () => {
        xhrMapRef.current.delete(uploadFile.id)
        // 暂停时不 reject
      }
      
      xhr.ontimeout = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const elapsed = (Date.now() - uploadStartTime) / 1000
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        const timeoutMinutes = Math.round(timeout / 60000)
        reject(new Error(`上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`))
      }

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', uploadFile.file.type)
      uploadStartTime = Date.now()
      xhr.send(uploadFile.file)
    })

    // 触发处理（不阻塞，异步执行）
    fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    }).catch((err) => {
      console.error('Failed to trigger photo processing:', err)
      // 不阻断流程，Worker 可以通过定时任务补偿
    })
  }

  // 暂停上传
  const pauseUpload = (fileId: string) => {
    const xhr = xhrMapRef.current.get(fileId)
    if (xhr) {
      xhr.abort()
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
      ))
    }
  }

  // 恢复上传（重新开始）
  const resumeUpload = (file: UploadFile) => {
    setFiles(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'pending' as const, progress: 0 } : f
    ))
    uploadQueueRef.current.unshift(file.id) // 加到队列最前面
    setTimeout(processQueue, 0)
  }

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

      // 2. 根据文件大小选择上传方式
      if (uploadFile.file.size >= PRESIGN_THRESHOLD) {
        // 大文件直接上传到 Worker（绕过 Vercel 4.5MB 限制）
        await uploadToWorkerDirectly(uploadFile, photoId, originalKey, respAlbumId)
      } else {
        // 小文件通过 Vercel 代理上传
        await uploadDirectly(uploadFile, photoId, uploadUrl, originalKey, respAlbumId)
      }

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
      // 检查是否是暂停导致的中断
      const currentFile = files.find(f => f.id === uploadFile.id)
      if (currentFile?.status === 'paused') {
        return // 暂停状态，不标记为失败
      }
      
      // 更新状态为失败
      const errorMessage = err instanceof Error ? err.message : '上传失败'
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'failed' as const,
                error: errorMessage,
              }
            : f
        )
      )
    } finally {
      // 上传完成（无论成功失败），处理队列中的下一个文件
      setTimeout(processQueue, 100)
    }
  }

  // 重试失败的上传
  const retryUpload = (uploadFile: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id
          ? { ...f, status: 'pending' as const, progress: 0, error: undefined }
          : f
      )
    )
    uploadSingleFile(uploadFile)
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
  const pausedCount = files.filter((f) => f.status === 'paused').length
  const pendingCount = files.filter((f) => f.status === 'pending').length

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
                ? `正在上传 ${uploadingCount}/${MAX_CONCURRENT_UPLOADS}${pendingCount > 0 ? `，等待 ${pendingCount}` : ''}${pausedCount > 0 ? `，暂停 ${pausedCount}` : ''}`
                : pausedCount > 0
                ? `已暂停 ${pausedCount} 个，已完成 ${completedCount}/${files.length}`
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
                  {file.status === 'paused' && (
                    <Pause className="w-5 h-5 text-yellow-400" />
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
                  {file.status === 'uploading' || file.status === 'paused' ? (
                    <div 
                      className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden cursor-pointer group/progress"
                      onClick={() => file.status === 'uploading' ? pauseUpload(file.id) : resumeUpload(file)}
                      title={file.status === 'uploading' ? '点击暂停' : '点击继续'}
                    >
                      <div 
                        className={cn(
                          "h-full transition-all duration-300 ease-out",
                          file.status === 'paused' ? 'bg-yellow-400' : 'bg-accent'
                        )}
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

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* 暂停/继续按钮 */}
                  {file.status === 'uploading' && (
                    <button
                      onClick={() => pauseUpload(file.id)}
                      className="p-1 text-yellow-400 hover:text-yellow-300"
                      title="暂停"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {file.status === 'paused' && (
                    <button
                      onClick={() => resumeUpload(file)}
                      className="p-1 text-green-400 hover:text-green-300"
                      title="继续"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {/* 重试按钮 */}
                  {file.status === 'failed' && (
                    <button
                      onClick={() => retryUpload(file)}
                      className="p-1 text-accent hover:text-accent/80"
                      title="重试"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {/* 移除按钮 */}
                  {file.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-text-muted hover:text-text-primary"
                      title="移除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
