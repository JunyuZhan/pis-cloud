'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, RefreshCw, Pause, Play } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

// 上传配置
// const PRESIGN_THRESHOLD = 4 * 1024 * 1024 // 4MB 以上直接上传到 Worker (保留供将来使用)
const MAX_CONCURRENT_UPLOADS = 3 // 最大同时上传数量
const MAX_RETRIES = 3 // 最大重试次数

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

export function PhotoUploader({ albumId, onComplete }: PhotoUploaderProps) {
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
        // 过滤队列：移除已完成、失败或暂停的文件，只保留 pending 状态的文件
        uploadQueueRef.current = uploadQueueRef.current.filter(fileId => {
          const file = currentFiles.find(f => f.id === fileId)
          // 保留 pending 状态的文件，移除其他状态的文件
          return file && file.status === 'pending'
        })

        if (uploadQueueRef.current.length > 0 && availableSlots > 0) {
          const toStart = uploadQueueRef.current.splice(0, availableSlots)
          toStart.forEach(fileId => {
            const file = currentFiles.find(f => f.id === fileId)
            if (file && file.status === 'pending') {
              uploadSingleFile(file)
            }
          })
        }
      }

      isProcessingQueueRef.current = false
      return currentFiles
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
    const invalidFiles: string[] = []
    
    const validFiles = fileArray.filter((file) => {
      // 严格检查：必须是图片类型
      const isValidType = allowedImageTypes.includes(file.type)
      const isValidSize = file.size <= 100 * 1024 * 1024 // 100MB
      
      // 如果类型不匹配，记录文件名
      if (!isValidType) {
        invalidFiles.push(file.name)
      }
      
      return isValidType && isValidSize
    })

    // 如果有无效文件（如视频），显示错误提示
    if (invalidFiles.length > 0) {
      const invalidCount = invalidFiles.length
      const fileList = invalidFiles.slice(0, 3).join('、')
      const moreText = invalidCount > 3 ? `等 ${invalidCount} 个文件` : ''
      alert(`不支持的文件类型：${fileList}${moreText}\n\n仅支持图片格式：JPG、PNG、HEIC、WebP`)
    }

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        const timeoutMinutes = Math.round(timeout / 60000)
        reject(new Error(`上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`))
      }

      const workerDirectUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
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
      // 处理 API 调用失败，延迟 3 秒后检查 pending 照片（事件驱动补偿）
      setTimeout(() => {
        fetch(`/api/admin/albums/${respAlbumId}/check-pending`, {
          method: 'POST',
        }).catch((checkErr) => {
          console.error('Failed to check pending photos:', checkErr)
        })
      }, 3000)
    })
  }

  // 小文件直接上传
  const uploadDirectly = async (
    uploadFile: UploadFile,
    photoId: string,
    uploadUrl: string,
    originalKey: string,
    respAlbumId: string,
    retryCount = 0
  ) => {
    let lastLoaded = 0
    let lastTime = Date.now()
    let uploadStartTime = Date.now()

    try {
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
          
          // 判断是否为可重试的网络错误（连接中断、超时等）
          const isRetryableError = xhr.status === 0 || 
            xhr.readyState === 0 || 
            (xhr.statusText === '' && xhr.responseText === '')
          
          const error = new Error(
            isRetryableError && retryCount < MAX_RETRIES
              ? `网络连接中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒），正在重试...`
              : `网络错误：文件上传中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒）。请检查网络连接或 Worker 服务状态`
          ) as Error & { retryable?: boolean }
          
          error.retryable = isRetryableError
          reject(error)
        }
        
        xhr.onabort = () => {
          xhrMapRef.current.delete(uploadFile.id)
          // 暂停时不 reject
        }
        
        xhr.ontimeout = () => {
          xhrMapRef.current.delete(uploadFile.id)
          const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
          const timeoutMinutes = Math.round(timeout / 60000)
          
          const error = new Error(
            retryCount < MAX_RETRIES
              ? `上传超时（${fileSizeMb}MB，已等待 ${timeoutMinutes} 分钟），正在重试...`
              : `上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`
          ) as Error & { retryable?: boolean }
          
          error.retryable = true
          reject(error)
        }

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', uploadFile.file.type)
        uploadStartTime = Date.now()
        xhr.send(uploadFile.file)
      })
    } catch (error) {
      // 检查是否为可重试的错误
      const err = error as Error & { retryable?: boolean }
      if (err.retryable && retryCount < MAX_RETRIES) {
        // 更新状态显示重试信息
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, error: `正在重试 (${retryCount + 1}/${MAX_RETRIES})...` }
              : f
          )
        )
        
        // 等待一段时间后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // 最多10秒
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // 重新获取上传凭证（presigned URL 可能已过期）
        try {
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
            throw new Error('重新获取上传凭证失败')
          }
          
          const credData = await credRes.json()
          if (credData?.error || !credData?.uploadUrl) {
            throw new Error('重新获取上传凭证失败：无效响应')
          }
          
          // 重置进度并重试
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress: 0, error: undefined } : f
            )
          )
          
          // 递归重试
          return uploadDirectly(
            uploadFile,
            photoId,
            credData.uploadUrl,
            credData.originalKey || originalKey,
            credData.albumId || respAlbumId,
            retryCount + 1
          )
        } catch (retryError) {
          throw new Error(`重试失败：${retryError instanceof Error ? retryError.message : '未知错误'}`)
        }
      }
      
      // 不可重试或已达到最大重试次数，抛出错误
      throw error
    }

    // 上传成功后才触发处理（避免上传失败时也触发处理）
    // 触发处理（不阻塞，异步执行）
    fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    }).catch((err) => {
      console.error('Failed to trigger photo processing:', err)
      // 处理 API 调用失败，延迟 3 秒后检查 pending 照片（事件驱动补偿）
      setTimeout(() => {
        fetch('/api/admin/albums/' + respAlbumId + '/check-pending', {
          method: 'POST',
        }).catch((checkErr) => {
          console.error('Failed to check pending photos:', checkErr)
        })
      }, 3000)
    })
  }

  // 暂停上传
  const pauseUpload = async (fileId: string) => {
    const xhr = xhrMapRef.current.get(fileId)
    const currentFile = files.find(f => f.id === fileId)
    
    if (xhr) {
      // 检查上传是否已经完成（readyState === 4 表示请求已完成）
      const isUploadCompleted = xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300
      
      // 如果上传已经完成，应该清理数据库记录而不是暂停
      if (isUploadCompleted && currentFile?.photoId) {
        // 上传已完成但用户暂停了，清理数据库记录
        try {
          const cleanupRes = await fetch(`/api/admin/photos/${currentFile.photoId}/cleanup`, {
            method: 'DELETE',
          })
          
          if (cleanupRes.ok) {
            console.log(`[Upload] Cleaned up paused upload (already completed): ${currentFile.photoId}`)
            // 标记为失败（因为用户取消了）
            setFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'failed' as const, error: '已取消上传' } : f
            ))
          } else {
            // 清理失败，仍然标记为暂停（可能 Worker 已经在处理）
            setFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
            ))
          }
        } catch (cleanupErr) {
          console.error(`[Upload] Failed to cleanup paused upload:`, cleanupErr)
          // 清理失败，仍然标记为暂停
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
          ))
        }
      } else {
        // 上传未完成，正常暂停
        xhr.abort()
        xhrMapRef.current.delete(fileId)
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
        ))
      }
      
      // 从队列中移除暂停的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
    } else if (currentFile?.photoId && currentFile.progress >= 100) {
      // 没有 XHR 引用但进度是 100%，说明上传已完成，清理数据库记录
      try {
        const cleanupRes = await fetch(`/api/admin/photos/${currentFile.photoId}/cleanup`, {
          method: 'DELETE',
        })
        
        if (cleanupRes.ok) {
          console.log(`[Upload] Cleaned up paused upload (progress 100%): ${currentFile.photoId}`)
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'failed' as const, error: '已取消上传' } : f
          ))
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
          ))
        }
      } catch (cleanupErr) {
        console.error(`[Upload] Failed to cleanup paused upload:`, cleanupErr)
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
        ))
      }
      
      // 从队列中移除
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
    } else {
      // 正常暂停（上传未完成，没有 photoId 或进度未到 100%）
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
      ))
      // 从队列中移除
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
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
    let photoId: string | undefined = undefined
    
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
        // 尝试解析错误信息
        let errorMessage = '获取上传凭证失败'
        let photoIdFromError: string | undefined = undefined
        
        try {
          const errorData = await credRes.json()
          if (errorData?.error?.message) {
            errorMessage = errorData.error.message
            // 如果有详细信息，也添加到错误消息中
            if (errorData?.error?.details) {
              errorMessage += `: ${errorData.error.details}`
            }
            // 如果错误响应中包含 photoId，说明记录已创建但后续步骤失败
            if (errorData?.photoId) {
              photoIdFromError = errorData.photoId
            }
          } else if (errorData?.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : errorMessage
            if (errorData?.photoId) {
              photoIdFromError = errorData.photoId
            }
          }
        } catch {
          // 如果响应不是 JSON，使用状态文本
          errorMessage = `获取上传凭证失败 (${credRes.status} ${credRes.statusText})`
        }
        
        // 如果获取凭证失败但照片记录已创建，尝试清理
        if (photoIdFromError) {
          try {
            const cleanupRes = await fetch(`/api/admin/photos/${photoIdFromError}/cleanup`, {
              method: 'DELETE',
            })
            if (cleanupRes.ok) {
              console.log(`[Upload] Cleaned up photo record after credential failure: ${photoIdFromError}`)
            } else {
              // 清理失败，延迟检查 pending 照片
              setTimeout(() => {
                fetch(`/api/admin/albums/${albumId}/check-pending`, {
                  method: 'POST',
                }).catch((checkErr) => {
                  console.error('Failed to check pending photos after credential failure:', checkErr)
                })
              }, 2000)
            }
          } catch (cleanupErr) {
            console.error('[Upload] Failed to cleanup photo record after credential failure:', cleanupErr)
            // 清理失败，延迟检查 pending 照片
            setTimeout(() => {
              fetch(`/api/admin/albums/${albumId}/check-pending`, {
                method: 'POST',
              }).catch((checkErr) => {
                console.error('Failed to check pending photos after credential failure:', checkErr)
              })
            }, 2000)
          }
        }
        
        throw new Error(errorMessage)
      }

      const credData = await credRes.json()
      
      // 检查响应中是否有错误
      if (credData?.error) {
        const errorMessage = credData.error.message || credData.error || '获取上传凭证失败'
        // 如果响应中包含 photoId，说明记录已创建但后续步骤失败，需要清理
        if (credData.photoId) {
          try {
            const cleanupRes = await fetch(`/api/admin/photos/${credData.photoId}/cleanup`, {
              method: 'DELETE',
            })
            if (cleanupRes.ok) {
              console.log(`[Upload] Cleaned up photo record after credential error: ${credData.photoId}`)
            } else {
              // 清理失败，延迟检查 pending 照片
              setTimeout(() => {
                fetch(`/api/admin/albums/${albumId}/check-pending`, {
                  method: 'POST',
                }).catch((checkErr) => {
                  console.error('Failed to check pending photos after credential error:', checkErr)
                })
              }, 2000)
            }
          } catch (cleanupErr) {
            console.error('[Upload] Failed to cleanup photo record after credential error:', cleanupErr)
            // 清理失败，延迟检查 pending 照片
            setTimeout(() => {
              fetch(`/api/admin/albums/${albumId}/check-pending`, {
                method: 'POST',
              }).catch((checkErr) => {
                console.error('Failed to check pending photos after credential error:', checkErr)
              })
            }, 2000)
          }
        }
        throw new Error(errorMessage)
      }
      
      photoId = credData.photoId as string
      const { uploadUrl, originalKey, albumId: respAlbumId } = credData

      if (!photoId) {
        throw new Error('获取上传凭证失败：缺少photoId')
      }
      
      if (!uploadUrl) {
        // 如果缺少上传地址，说明获取凭证失败，尝试清理已创建的照片记录
        try {
          await fetch(`/api/admin/photos/${photoId}/cleanup`, {
            method: 'DELETE',
          })
          console.log(`[Upload] Cleaned up photo record after missing uploadUrl: ${photoId}`)
        } catch (cleanupErr) {
          console.error('[Upload] Failed to cleanup photo record after missing uploadUrl:', cleanupErr)
        }
        throw new Error('获取上传凭证失败：缺少上传地址')
      }

      // 保存 photoId 和 respAlbumId 到 uploadFile，以便失败时清理和检查
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, photoId, respAlbumId } : f
        )
      )

      // 2. 统一使用代理上传（避免前端直接访问内网Worker的问题）
      // 注意：Vercel有4.5MB限制，但通过代理上传可以绕过
      await uploadDirectly(uploadFile, photoId!, uploadUrl, originalKey, respAlbumId)

      // 3. 上传成功，触发 Worker 处理（uploadDirectly 内部已触发，这里确保状态更新）
      // 注意：处理请求在 uploadDirectly 内部异步触发，不阻塞
      
      // 更新状态为完成（前端显示）
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        )
      )
      
      // 从队列中移除已完成的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)

      // 刷新页面数据（显示处理中的照片）
      router.refresh()
    } catch (err) {
      // 检查是否是暂停导致的中断
      const currentFile = files.find(f => f.id === uploadFile.id)
      if (currentFile?.status === 'paused') {
        return // 暂停状态，不标记为失败
      }
      
      // 上传失败：清理数据库记录和 MinIO 文件
      // 协调机制：前端失败 → 清理数据库 → 清理 MinIO → Worker 队列任务自动跳过
      let cleanupSuccess = false
      let albumIdForCheck: string | undefined = undefined
      
      if (photoId) {
        try {
          const cleanupRes = await fetch(`/api/admin/photos/${photoId}/cleanup`, {
            method: 'DELETE',
          })
          
          if (cleanupRes.ok) {
            console.log(`[Upload] Cleaned up failed upload: ${photoId}`)
            cleanupSuccess = true
          } else {
            const errorData = await cleanupRes.json().catch(() => ({}))
            console.error(`[Upload] Cleanup failed for ${photoId}:`, errorData)
            // 清理失败，记录相册 ID 以便后续检查
            albumIdForCheck = uploadFile.respAlbumId || albumId
          }
        } catch (cleanupErr) {
          console.error('[Upload] Failed to cleanup photo record:', cleanupErr)
          // 清理失败，记录相册 ID 以便后续检查
          albumIdForCheck = uploadFile.respAlbumId || albumId
        }
      } else {
        // 如果没有 photoId，说明可能是在获取凭证阶段就失败了
        // 但为了保险，还是检查一下相册的 pending 照片
        albumIdForCheck = uploadFile.respAlbumId || albumId
      }
      
      // 更新前端状态为失败
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
      
      // 从队列中移除失败的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
      
      // 如果清理失败或没有 photoId，延迟检查 pending 照片（事件驱动补偿）
      if (albumIdForCheck && !cleanupSuccess) {
        setTimeout(() => {
          fetch(`/api/admin/albums/${albumIdForCheck}/check-pending`, {
            method: 'POST',
          }).catch((checkErr) => {
            console.error('Failed to check pending photos after upload failure:', checkErr)
          })
        }, 2000) // 延迟 2 秒，给清理操作一些时间
      }
      
      // 无论清理成功与否，都刷新页面数据以更新处理中的照片数量
      // 这样即使清理失败，用户也能看到实际状态
      router.refresh()
      if (cleanupSuccess) {
        onComplete?.()
      }
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
    // 将文件重新加入队列（如果不在队列中）
    if (!uploadQueueRef.current.includes(uploadFile.id)) {
      uploadQueueRef.current.push(uploadFile.id)
    }
    // 触发队列处理
    setTimeout(processQueue, 0)
  }

  const removeFile = (id: string) => {
    // 取消正在进行的上传
    const xhr = xhrMapRef.current.get(id)
    if (xhr) {
      xhr.abort()
      xhrMapRef.current.delete(id)
    }
    // 从队列中移除
    uploadQueueRef.current = uploadQueueRef.current.filter(fileId => fileId !== id)
    // 从文件列表中移除
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
          accept="image/jpeg,image/png,image/heic,image/webp,.jpg,.jpeg,.png,.heic,.webp"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files)
              // 重置 input，允许重复选择相同文件
              e.target.value = ''
            }
          }}
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
