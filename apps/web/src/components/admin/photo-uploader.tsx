'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

// 分片上传配置
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB per chunk
const MAX_CONCURRENT_CHUNKS = 3 // 同时上传 3 个分片
const MAX_RETRIES = 3 // 每个分片最多重试 3 次
const MULTIPART_THRESHOLD = 10 * 1024 * 1024 // 10MB 以上使用分片上传

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
  // 分片上传状态
  uploadId?: string
  originalKey?: string
  photoId?: string
  uploadedParts?: Array<{ partNumber: number; etag: string }>
  totalParts?: number
}

export function PhotoUploader({ albumId, onComplete }: PhotoUploaderProps) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const completedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

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
    return () => {
      completedTimersRef.current.forEach((timer) => clearTimeout(timer))
      completedTimersRef.current.clear()
    }
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

    setFiles((prev) => [...prev, ...uploadFiles])

    // 开始上传
    uploadFiles.forEach((uploadFile) => {
      uploadSingleFile(uploadFile)
    })
  }, [albumId])

  // 获取 Worker API URL
  const getWorkerUrl = () => {
    return process.env.NEXT_PUBLIC_WORKER_URL || ''
  }

  // 上传单个分片（带重试）
  const uploadChunkWithRetry = async (
    chunk: Blob,
    key: string,
    uploadId: string,
    partNumber: number,
    onProgress: (loaded: number) => void
  ): Promise<{ partNumber: number; etag: string }> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          const workerUrl = getWorkerUrl()
          const url = `${workerUrl}/api/multipart/upload?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress(event.loaded)
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText)
                resolve({ partNumber, etag: response.etag })
              } catch {
                reject(new Error('无效的响应'))
              }
            } else {
              reject(new Error(`分片 ${partNumber} 上传失败: ${xhr.status}`))
            }
          }

          xhr.onerror = () => reject(new Error('网络错误'))
          xhr.ontimeout = () => reject(new Error('上传超时'))

          xhr.open('PUT', url)
          xhr.setRequestHeader('Content-Type', 'application/octet-stream')
          xhr.send(chunk)
        })
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('未知错误')
        console.warn(`分片 ${partNumber} 第 ${attempt + 1} 次尝试失败:`, lastError.message)
        // 等待一段时间再重试
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }
    
    throw lastError || new Error(`分片 ${partNumber} 上传失败`)
  }

  // 分片上传大文件
  const uploadWithChunks = async (
    uploadFile: UploadFile,
    photoId: string,
    originalKey: string,
    respAlbumId: string
  ) => {
    const file = uploadFile.file
    const totalParts = Math.ceil(file.size / CHUNK_SIZE)
    const workerUrl = getWorkerUrl()
    
    // 1. 初始化分片上传
    const initRes = await fetch(`${workerUrl}/api/multipart/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: originalKey }),
    })
    
    if (!initRes.ok) {
      throw new Error('初始化分片上传失败')
    }
    
    const { uploadId } = await initRes.json()
    
    // 更新状态，保存 uploadId 用于断点续传
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id
          ? { ...f, uploadId, originalKey, photoId, totalParts, uploadedParts: [] }
          : f
      )
    )

    // 2. 准备所有分片
    const chunks: Array<{ partNumber: number; start: number; end: number }> = []
    for (let i = 0; i < totalParts; i++) {
      chunks.push({
        partNumber: i + 1,
        start: i * CHUNK_SIZE,
        end: Math.min((i + 1) * CHUNK_SIZE, file.size),
      })
    }

    // 3. 并行上传分片
    const uploadedParts: Array<{ partNumber: number; etag: string }> = []
    let uploadedBytes = 0
    const chunkProgress = new Map<number, number>()
    let lastTime = Date.now()
    let lastBytes = 0

    const updateProgress = () => {
      let totalUploaded = uploadedBytes
      chunkProgress.forEach((loaded) => {
        totalUploaded += loaded
      })
      
      const progress = Math.round((totalUploaded / file.size) * 100)
      const now = Date.now()
      const timeDiff = (now - lastTime) / 1000
      
      let speed = 0
      if (timeDiff >= 0.2) {
        const bytesDiff = totalUploaded - lastBytes
        speed = bytesDiff / timeDiff
        lastBytes = totalUploaded
        lastTime = now
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, progress, ...(speed > 0 ? { speed } : {}), uploadedParts }
            : f
        )
      )
    }

    // 使用队列控制并发
    const queue = [...chunks]
    const workers: Promise<void>[] = []

    for (let i = 0; i < MAX_CONCURRENT_CHUNKS; i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const chunk = queue.shift()
            if (!chunk) break

            const blob = file.slice(chunk.start, chunk.end)
            const result = await uploadChunkWithRetry(
              blob,
              originalKey,
              uploadId,
              chunk.partNumber,
              (loaded) => {
                chunkProgress.set(chunk.partNumber, loaded)
                updateProgress()
              }
            )

            uploadedParts.push(result)
            uploadedBytes += blob.size
            chunkProgress.delete(chunk.partNumber)
            updateProgress()
          }
        })()
      )
    }

    await Promise.all(workers)

    // 4. 完成分片上传
    const sortedParts = uploadedParts.sort((a, b) => a.partNumber - b.partNumber)
    
    const completeRes = await fetch(`${workerUrl}/api/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: originalKey,
        uploadId,
        parts: sortedParts,
      }),
    })

    if (!completeRes.ok) {
      throw new Error('完成分片上传失败')
    }

    // 5. 触发处理
    await fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
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

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
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

    // 触发处理
    await fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    })
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
      if (uploadFile.file.size >= MULTIPART_THRESHOLD) {
        // 大文件使用分片上传
        await uploadWithChunks(uploadFile, photoId, originalKey, respAlbumId)
      } else {
        // 小文件直接上传
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

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 shrink-0">
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
