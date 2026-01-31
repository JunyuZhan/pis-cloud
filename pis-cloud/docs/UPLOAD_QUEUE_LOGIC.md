# 上传任务队列逻辑说明

## 概述

PIS 系统使用前端队列管理机制来控制文件上传，确保：
- 控制并发数量，避免浏览器资源耗尽
- 支持暂停/恢复上传
- 自动重试失败的上传
- 实时显示上传进度和速度

## 核心配置

```typescript
const MAX_CONCURRENT_UPLOADS = 3  // 最大同时上传数量
const MAX_RETRIES = 3              // 最大重试次数
const MULTIPART_THRESHOLD = 5MB   // 分片上传阈值
const CHUNK_SIZE = 1MB            // 分片大小
```

## 队列数据结构

### 文件状态

```typescript
interface UploadFile {
  id: string                    // 唯一标识符
  file: File                    // 文件对象
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  progress: number              // 上传进度 (0-100)
  speed?: number                // 上传速度 (bytes/s)
  error?: string                // 错误信息
  originalKey?: string          // 存储路径
  photoId?: string              // 照片 ID
  uploadUrl?: string            // 上传 URL
}
```

### 队列引用

```typescript
const uploadQueueRef = useRef<string[]>([])           // 等待上传的文件 ID 队列
const isProcessingQueueRef = useRef(false)            // 队列处理标志（防止重复处理）
const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map())  // XHR 请求映射（用于取消）
```

## 队列处理流程

### 1. 添加文件到队列

```typescript
// 用户选择文件后
const uploadFiles: UploadFile[] = files.map(file => ({
  id: Math.random().toString(36).substr(2, 9),
  file,
  status: 'pending',
  progress: 0,
}))

// 将文件 ID 加入队列
uploadQueueRef.current.push(...uploadFiles.map(f => f.id))

// 更新文件列表
setFiles((prev) => [...prev, ...uploadFiles])

// 触发队列处理
setTimeout(processQueue, 0)
```

### 2. 队列处理逻辑 (`processQueue`)

```typescript
const processQueue = useCallback(() => {
  // 防止重复处理
  if (isProcessingQueueRef.current) return
  isProcessingQueueRef.current = true

  setTimeout(() => {
    setFiles(currentFiles => {
      // 1. 计算可用上传槽位
      const uploadingCount = currentFiles.filter(f => f.status === 'uploading').length
      const availableSlots = MAX_CONCURRENT_UPLOADS - uploadingCount

      if (availableSlots > 0 && uploadQueueRef.current.length > 0) {
        // 2. 清理队列：移除非 pending 状态的文件
        uploadQueueRef.current = uploadQueueRef.current.filter(fileId => {
          const file = currentFiles.find(f => f.id === fileId)
          return file && file.status === 'pending'
        })

        if (uploadQueueRef.current.length > 0 && availableSlots > 0) {
          // 3. 取出要上传的文件（FIFO）
          const toStart = uploadQueueRef.current.splice(0, availableSlots)
          isProcessingQueueRef.current = false

          // 4. 异步启动上传
          toStart.forEach(fileId => {
            const file = currentFiles.find(f => f.id === fileId)
            if (file && file.status === 'pending') {
              setTimeout(() => {
                uploadSingleFile(file)
              }, 0)
            }
          })
        }
      }

      isProcessingQueueRef.current = false
      return currentFiles
    })
  }, 0)
}, [])
```

**关键点：**
- 使用 `setTimeout` 确保在下一个事件循环处理，避免状态更新冲突
- FIFO（先进先出）队列顺序
- 自动清理非 pending 状态的文件
- 异步启动上传，不阻塞状态更新

### 3. 单个文件上传流程 (`uploadSingleFile`)

```typescript
const uploadSingleFile = async (uploadFile: UploadFile) => {
  try {
    // 1. 更新状态为 uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
    ))

    // 2. 获取上传凭证
    const credRes = await fetch(`/api/admin/albums/${albumId}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filename: uploadFile.file.name,
        contentType: uploadFile.file.type,
        fileSize: uploadFile.file.size,
      }),
    })
    const { photoId, uploadUrl, originalKey } = await credRes.json()

    // 3. 根据文件大小选择上传方式
    if (uploadFile.file.size >= MULTIPART_THRESHOLD) {
      // 大文件：分片上传
      await uploadMultipart(uploadFile, photoId, uploadUrl, originalKey)
    } else {
      // 小文件：直接上传
      await uploadDirect(uploadFile, photoId, uploadUrl, originalKey)
    }

    // 4. 上传完成，更新状态
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id 
        ? { ...f, status: 'completed', progress: 100 }
        : f
    ))

    // 5. 从队列中移除
    uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)

    // 6. 触发照片处理
    await triggerPhotoProcessing(photoId, albumId, originalKey)

    // 7. 继续处理队列
    setTimeout(processQueue, 0)

  } catch (error) {
    // 错误处理（见下方）
  }
}
```

### 4. 上传方式选择

#### 小文件直接上传（< 5MB）

```typescript
const uploadDirect = async (file, photoId, uploadUrl, originalKey) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhrMapRef.current.set(file.id, xhr)

    // 进度监听
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100
        const speed = e.loaded / ((Date.now() - startTime) / 1000)
        setFiles(prev => prev.map(f =>
          f.id === file.id 
            ? { ...f, progress, speed }
            : f
        ))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}
```

#### 大文件分片上传（≥ 5MB）

```typescript
const uploadMultipart = async (file, photoId, uploadUrl, originalKey) => {
  // 1. 初始化分片上传
  const initRes = await fetch('/api/worker/multipart/init', {
    method: 'POST',
    body: JSON.stringify({ key: originalKey, contentType: file.type }),
  })
  const { uploadId } = await initRes.json()

  // 2. 计算分片数量
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const parts: Array<{ partNumber: number; etag: string }> = []

  // 3. 并行上传分片（每批 2 个）
  const batchSize = 2
  for (let i = 0; i < totalChunks; i += batchSize) {
    const batch = []
    for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
      const start = j * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)
      
      batch.push(
        uploadChunk(originalKey, uploadId, j + 1, chunk).then(etag => {
          parts.push({ partNumber: j + 1, etag })
          // 更新进度
          const progress = ((parts.length / totalChunks) * 100)
          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, progress } : f
          ))
        })
      )
    }
    await Promise.all(batch)
  }

  // 4. 完成分片上传
  await fetch('/api/worker/multipart/complete', {
    method: 'POST',
    body: JSON.stringify({ key: originalKey, uploadId, parts }),
  })
}
```

## 错误处理和重试

### 错误处理流程

```typescript
catch (error) {
  // 1. 检查是否是暂停导致的中断
  if (currentFile?.status === 'paused') {
    return // 不处理暂停的文件
  }

  // 2. 检查重试次数
  const retryCount = currentFile?.retryCount || 0
  if (retryCount < MAX_RETRIES) {
    // 3. 延迟重试（指数退避）
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
    setTimeout(() => {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id 
          ? { ...f, status: 'pending', retryCount: retryCount + 1 }
          : f
      ))
      uploadQueueRef.current.unshift(uploadFile.id) // 加到队列前面
      setTimeout(processQueue, 0)
    }, delay)
  } else {
    // 4. 超过重试次数，标记为失败
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id 
        ? { ...f, status: 'failed', error: error.message }
        : f
    ))
    uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
  }
}
```

## 暂停和恢复

### 暂停上传

```typescript
const pauseUpload = async (fileId: string) => {
  const xhr = xhrMapRef.current.get(fileId)
  const currentFile = files.find(f => f.id === fileId)

  if (xhr) {
    // 取消 XHR 请求
    xhr.abort()
    xhrMapRef.current.delete(fileId)

    // 更新状态
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, status: 'paused', speed: undefined } : f
    ))

    // 从队列中移除
    uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)

    // 如果上传已完成但用户暂停，清理数据库记录
    if (xhr.readyState === 4 && currentFile?.photoId) {
      await fetch(`/api/admin/photos/${currentFile.photoId}/cleanup`, {
        method: 'DELETE',
      })
    }
  }
}
```

### 恢复上传

```typescript
const resumeUpload = (file: UploadFile) => {
  // 检查是否可以恢复
  if (file.status === 'completed' || file.progress >= 100) {
    return
  }

  // 重置状态
  setFiles(prev => prev.map(f =>
    f.id === file.id 
      ? { ...f, status: 'pending', progress: 0, error: undefined }
      : f
  ))

  // 加到队列最前面（优先处理）
  uploadQueueRef.current.unshift(file.id)
  setTimeout(processQueue, 0)
}
```

## 自动清理

### 已完成文件自动移除

```typescript
useEffect(() => {
  files.forEach((file) => {
    if (file.status === 'completed') {
      // 2秒后自动移除
      if (!completedTimersRef.current.has(file.id)) {
        const timer = setTimeout(() => {
          setFiles((prev) => prev.filter((f) => f.id !== file.id))
          completedTimersRef.current.delete(file.id)
        }, 2000)
        completedTimersRef.current.set(file.id, timer)
      }
    } else {
      // 清理定时器
      if (completedTimersRef.current.has(file.id)) {
        clearTimeout(completedTimersRef.current.get(file.id)!)
        completedTimersRef.current.delete(file.id)
      }
    }
  })
}, [files])
```

## 队列状态管理

### 状态转换图

```
pending → uploading → completed
   ↓         ↓
paused    failed
   ↓
pending (resume)
```

### 队列清理规则

1. **自动清理**：已完成文件 2 秒后自动移除
2. **手动清理**：用户点击删除按钮
3. **状态过滤**：队列处理时自动移除非 pending 状态的文件

## 性能优化

1. **并发控制**：最多 3 个文件同时上传
2. **分片上传**：大文件分片上传，避免超时
3. **批量处理**：分片并行上传（每批 2 个）
4. **异步处理**：使用 `setTimeout` 避免阻塞 UI
5. **进度更新**：实时更新上传进度和速度

## 注意事项

1. **队列顺序**：FIFO（先进先出），恢复时优先处理
2. **状态一致性**：使用 `setFiles` 函数式更新确保状态一致
3. **资源清理**：组件卸载时清理所有定时器和 XHR 请求
4. **错误恢复**：自动重试机制，指数退避策略
5. **数据库同步**：上传完成后触发照片处理，失败时清理记录

## 流程图

```
用户选择文件
    ↓
添加到队列 (status: pending)
    ↓
processQueue 检查可用槽位
    ↓
有可用槽位？
    ├─ 是 → 取出文件，启动上传 (status: uploading)
    │         ↓
    │      上传方式选择
    │         ├─ < 5MB → 直接上传
    │         └─ ≥ 5MB → 分片上传
    │         ↓
    │      上传完成 (status: completed)
    │         ↓
    │      触发照片处理
    │         ↓
    │      2秒后自动移除
    │         ↓
    │      继续处理队列
    │
    └─ 否 → 等待槽位释放
```

## 相关文件

- `apps/web/src/components/admin/photo-uploader.tsx` - 上传组件主文件
- `apps/web/src/app/api/worker/[...path]/route.ts` - Worker 代理路由
- `services/worker/src/index.ts` - Worker 服务端处理
