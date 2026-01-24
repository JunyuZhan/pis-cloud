# 扫描同步功能开发文档

## 功能概述

允许管理员通过 MinIO Console、S3 客户端（如 rclone、mc）等工具直接将图片上传到 MinIO，然后在后台管理界面点击「扫描同步」按钮，系统自动将新图片入库并生成缩略图/预览图。

### 使用场景

1. **批量上传大量图片**：使用专业工具（rclone、MinIO Client）批量上传，避免浏览器限制
2. **从其他系统迁移**：直接将现有图片目录同步到 MinIO
3. **断点续传大文件**：使用 mc 客户端的断点续传功能

### 与现有功能的关系

| 功能 | 存储路径 | 触发方式 | 适用场景 |
|------|----------|----------|----------|
| 前端上传 | `raw/{album_id}/{photo_id}.{ext}` | 自动 | 日常使用 |
| 扫描同步 | `sync/{album_id}/*.{ext}` | 手动点击 | 批量导入 |

两种方式最终都会：
- 在 `photos` 表创建记录
- 生成缩略图到 `processed/thumbs/{album_id}/`
- 生成预览图到 `processed/previews/{album_id}/`

---

## 技术架构

### 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│  管理员使用工具上传到 MinIO                                        │
│  目标路径: bucket/sync/{album_id}/filename.jpg                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  管理员在后台点击「扫描同步」按钮                                    │
│  前端调用: POST /api/admin/albums/{id}/scan                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js API 转发请求到 Worker                                   │
│  Worker 端点: POST /api/scan                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Worker 扫描逻辑:                                                 │
│  1. 列出 sync/{album_id}/ 目录下所有文件                           │
│  2. 过滤出图片文件（jpg, png, heic, webp）                         │
│  3. 查询数据库，找出未入库的新文件                                  │
│  4. 为每个新文件:                                                 │
│     a. 生成 photo_id (UUID)                                      │
│     b. 移动到 raw/{album_id}/{photo_id}.{ext}                    │
│     c. 创建 photos 记录 (status: pending)                        │
│     d. 添加到处理队列                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BullMQ 处理队列（复用现有逻辑）                                    │
│  - 生成缩略图 (400px)                                             │
│  - 生成预览图 (2560px) + 水印                                      │
│  - 提取 EXIF、生成 BlurHash                                       │
│  - 更新数据库状态为 completed                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 详细实现步骤

### 第一步：扩展 StorageAdapter 接口

**文件**: `services/worker/src/lib/storage/types.ts`

添加列出目录的方法：

```typescript
export interface StorageAdapter {
  // ... 现有方法 ...
  
  /**
   * 列出指定前缀下的所有对象
   * @param prefix 前缀路径，如 "sync/album-uuid/"
   * @returns 对象列表
   */
  listObjects(prefix: string): Promise<StorageObject[]>;
  
  /**
   * 复制对象（用于移动文件）
   * @param srcKey 源路径
   * @param destKey 目标路径
   */
  copy(srcKey: string, destKey: string): Promise<void>;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}
```

### 第二步：实现 MinIOAdapter 的新方法

**文件**: `services/worker/src/lib/storage/minio-adapter.ts`

```typescript
async listObjects(prefix: string): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  const stream = this.client.listObjectsV2(this.bucket, prefix, true);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) {
        objects.push({
          key: obj.name,
          size: obj.size || 0,
          lastModified: obj.lastModified || new Date(),
          etag: obj.etag || '',
        });
      }
    });
    stream.on('end', () => resolve(objects));
    stream.on('error', (err) => reject(err));
  });
}

async copy(srcKey: string, destKey: string): Promise<void> {
  await this.client.copyObject(
    this.bucket,
    destKey,
    `/${this.bucket}/${srcKey}`
  );
}
```

### 第三步：更新 storage/index.ts 导出

**文件**: `services/worker/src/lib/storage/index.ts`

```typescript
// 添加新的导出函数
export async function listObjects(prefix: string): Promise<StorageObject[]> {
  return getStorageAdapter().listObjects(prefix);
}

export async function copyFile(srcKey: string, destKey: string): Promise<void> {
  return getStorageAdapter().copy(srcKey, destKey);
}

export async function deleteFile(key: string): Promise<void> {
  return getStorageAdapter().delete(key);
}
```

### 第四步：创建扫描同步 API（Worker 端）

**文件**: `services/worker/src/index.ts`

在 HTTP 服务器中添加新端点：

```typescript
// 扫描同步 API
if (url.pathname === '/api/scan' && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { albumId } = JSON.parse(body);
      if (!albumId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing albumId' }));
        return;
      }

      console.log(`[Scan] Starting scan for album: ${albumId}`);
      
      // 1. 列出 sync/{albumId}/ 下的所有文件
      const prefix = `sync/${albumId}/`;
      const objects = await listObjects(prefix);
      
      // 2. 过滤出图片文件
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp'];
      const imageObjects = objects.filter(obj => {
        const ext = obj.key.toLowerCase().slice(obj.key.lastIndexOf('.'));
        return imageExtensions.includes(ext);
      });

      console.log(`[Scan] Found ${imageObjects.length} images in ${prefix}`);

      if (imageObjects.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          found: 0, 
          added: 0,
          message: '未找到新图片' 
        }));
        return;
      }

      // 3. 查询数据库已有的文件（通过 filename 比对）
      const { data: existingPhotos } = await supabase
        .from('photos')
        .select('filename')
        .eq('album_id', albumId);
      
      const existingFilenames = new Set(
        (existingPhotos || []).map(p => p.filename)
      );

      // 4. 处理新图片
      let addedCount = 0;
      for (const obj of imageObjects) {
        const filename = obj.key.split('/').pop() || '';
        
        // 跳过已存在的文件
        if (existingFilenames.has(filename)) {
          console.log(`[Scan] Skipping existing: ${filename}`);
          continue;
        }

        // 生成新的 photo_id
        const photoId = crypto.randomUUID();
        const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
        const newKey = `raw/${albumId}/${photoId}.${ext}`;

        // 复制文件到标准路径
        await copyFile(obj.key, newKey);
        console.log(`[Scan] Copied ${obj.key} -> ${newKey}`);

        // 创建数据库记录
        const { error: insertError } = await supabase
          .from('photos')
          .insert({
            id: photoId,
            album_id: albumId,
            original_key: newKey,
            filename: filename,
            file_size: obj.size,
            status: 'pending',
          });

        if (insertError) {
          console.error(`[Scan] Failed to insert photo: ${insertError.message}`);
          continue;
        }

        // 添加到处理队列
        await photoQueue.add('process-photo', { 
          photoId, 
          albumId, 
          originalKey: newKey 
        });

        // 删除原始文件（可选，或保留备份）
        await deleteFile(obj.key);
        
        addedCount++;
      }

      console.log(`[Scan] Added ${addedCount} new photos`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        found: imageObjects.length,
        skipped: imageObjects.length - addedCount,
        added: addedCount,
        message: `成功导入 ${addedCount} 张新图片` 
      }));
    } catch (err: any) {
      console.error('[Scan] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  return;
}
```

### 第五步：创建 Next.js API 路由

**文件**: `apps/web/src/app/api/admin/albums/[id]/scan/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Worker 服务 URL
const WORKER_URL = process.env.WORKER_URL || 
                   process.env.WORKER_API_URL || 
                   process.env.NEXT_PUBLIC_WORKER_URL || 
                   'http://localhost:3001'

/**
 * 触发扫描同步
 * POST /api/admin/albums/{id}/scan
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
    const supabase = await createClient()

    // 验证登录状态
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, title')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 调用 Worker 扫描 API
    const workerResponse = await fetch(`${WORKER_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    })

    if (!workerResponse.ok) {
      const error = await workerResponse.json()
      return NextResponse.json(
        { error: { code: 'WORKER_ERROR', message: error.error || 'Worker 服务错误' } },
        { status: 500 }
      )
    }

    const result = await workerResponse.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Scan API error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
```

### 第六步：添加前端扫描按钮

**文件**: `apps/web/src/components/admin/scan-sync-button.tsx`

```tsx
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
    } catch (err) {
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
```

### 第七步：集成到相册详情页

**文件**: `apps/web/src/app/admin/(dashboard)/albums/[id]/page.tsx`

在操作按钮区域添加扫描同步按钮：

```tsx
import { ScanSyncButton } from '@/components/admin/scan-sync-button'

// 在 JSX 中添加
<div className="flex items-center gap-2 sm:gap-3 flex-wrap">
  {/* 扫描同步 */}
  <ScanSyncButton 
    albumId={id} 
    onComplete={() => router.refresh()} 
  />
  {/* 打包下载 */}
  <PackageDownloadButton ... />
  ...
</div>
```

---

## 存储目录结构

### 完整目录结构

```
bucket/
├── raw/                              # 原始图片（系统管理）
│   └── {album_id}/
│       ├── {photo_id_1}.jpg          # 前端上传或扫描导入
│       └── {photo_id_2}.png
│
├── sync/                             # 扫描同步目录（用户上传）
│   └── {album_id}/
│       ├── DSC_0001.jpg              # 用户直接上传的原始文件名
│       ├── DSC_0002.jpg
│       └── vacation_photo.png
│
└── processed/                        # 处理后的图片
    ├── thumbs/                       # 缩略图 (400px)
    │   └── {album_id}/
    │       └── {photo_id}.jpg
    │
    └── previews/                     # 预览图 (2560px + 水印)
        └── {album_id}/
            └── {photo_id}.jpg
```

### 用户操作指南

管理员使用 MinIO Client 上传：

```bash
# 安装 MinIO Client
brew install minio-mc

# 配置连接
mc alias set pis http://media.albertzhan.top minioadmin minioadmin

# 上传单个文件
mc cp photo.jpg pis/pis-photos/sync/{album_id}/

# 批量上传目录
mc cp --recursive ./photos/ pis/pis-photos/sync/{album_id}/

# 使用 rclone 同步
rclone sync ./photos/ pis:pis-photos/sync/{album_id}/
```

---

## 错误处理

### 常见错误及处理

| 错误场景 | 处理方式 |
|----------|----------|
| Worker 服务不可用 | 返回 503，提示用户稍后重试 |
| 相册不存在 | 返回 404 |
| 目录为空 | 返回成功，提示未找到新图片 |
| 文件已存在 | 跳过，不重复导入 |
| 处理队列满 | 照片入库但处理延迟 |
| 存储空间不足 | 返回错误，提示空间不足 |

---

## 安全考虑

1. **权限验证**：只有登录的管理员可以触发扫描
2. **相册隔离**：只能扫描指定相册目录，不能跨目录访问
3. **文件类型验证**：只处理图片格式（jpg, png, heic, webp）
4. **文件大小限制**：可设置单文件最大 100MB
5. **速率限制**：每个相册每分钟最多触发 1 次扫描

---

## 测试计划

### 单元测试

1. `listObjects` 方法正确返回文件列表
2. `copy` 方法正确复制文件
3. 文件类型过滤正确

### 集成测试

1. 扫描空目录 → 返回 0 张图片
2. 扫描有新图片 → 正确入库和处理
3. 扫描有重复图片 → 正确跳过
4. 扫描混合文件（图片+其他）→ 只处理图片

### 端到端测试

1. 使用 mc 上传图片到 `sync/{album_id}/`
2. 在后台点击扫描同步
3. 验证图片正确显示在相册中
4. 验证缩略图和预览图生成成功

---

## 后续优化

### Phase 2（可选）

1. **进度显示**：扫描大量图片时显示进度条
2. **定时扫描**：支持定时自动扫描（每小时/每天）
3. **MinIO 事件通知**：使用 Webhook 实现实时同步
4. **批量操作**：支持选择性导入部分图片

### Phase 3（可选）

1. **文件去重**：基于文件哈希去重，避免重复上传
2. **断点续传**：支持大文件断点续传
3. **压缩包导入**：支持上传 zip 包自动解压导入

---

## 变更清单

### 需要修改的文件

1. `services/worker/src/lib/storage/types.ts` - 添加接口
2. `services/worker/src/lib/storage/minio-adapter.ts` - 实现方法
3. `services/worker/src/lib/storage/index.ts` - 导出函数
4. `services/worker/src/index.ts` - 添加扫描 API
5. `apps/web/src/app/api/admin/albums/[id]/scan/route.ts` - 新建
6. `apps/web/src/components/admin/scan-sync-button.tsx` - 新建
7. `apps/web/src/app/admin/(dashboard)/albums/[id]/page.tsx` - 集成按钮

### 需要新建的文件

- `apps/web/src/app/api/admin/albums/[id]/scan/route.ts`
- `apps/web/src/components/admin/scan-sync-button.tsx`

### 数据库变更

无需数据库变更，复用现有 `photos` 表。
