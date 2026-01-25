# 照片上传协调机制

本文档说明前端、Worker、数据库和 MinIO 四个部分的协调机制，确保状态一致性。

## 📋 状态流转图

```
成功流程：
前端 → 获取凭证 → 创建DB记录(pending) → 上传到MinIO → 触发Worker → Worker处理 → 更新DB(completed)
                                                                              ↓
                                                                        生成缩略图/预览图
                                                                              ↓
                                                                        上传到MinIO
                                                                              ↓
                                                                        更新DB(completed)

失败流程：
前端 → 获取凭证 → 创建DB记录(pending) → 上传失败 → 清理DB记录 → 清理MinIO文件
                                                              ↓
                                                    Worker队列任务检查 → 记录不存在 → 跳过处理
```

## ✅ 成功流程

### 1. 前端上传阶段
- **步骤1**: 调用 `/api/admin/albums/{id}/upload` 获取上传凭证
  - 创建数据库记录：`status = 'pending'`
  - 返回 `photoId`, `uploadUrl`, `originalKey`
  
- **步骤2**: 使用 presigned URL 上传文件到 MinIO
  - 上传路径：`raw/{albumId}/{photoId}.{ext}`
  - 上传成功：HTTP 200-299
  
- **步骤3**: 上传成功后，触发 Worker 处理
  - 调用 `/api/admin/photos/process`
  - 异步执行，不阻塞前端

### 2. Worker 处理阶段
- **步骤1**: 接收处理请求，加入队列
  - 队列名称：`photo-processing`
  - 任务数据：`{ photoId, albumId, originalKey }`

- **步骤2**: Worker 处理任务
  - ✅ 检查数据库记录是否存在
  - ✅ 更新状态为 `processing`
  - ✅ 从 MinIO 下载原图
  - ✅ 生成缩略图（400px）和预览图（1920px）
  - ✅ 上传处理后的图片到 MinIO：
    - `processed/thumbs/{albumId}/{photoId}.jpg`
    - `processed/previews/{albumId}/{photoId}.jpg`
  - ✅ 更新数据库状态为 `completed`
  - ✅ 更新相册照片数量

### 3. 数据库状态
- `pending` → `processing` → `completed`

### 4. MinIO 文件
- 原图：`raw/{albumId}/{photoId}.{ext}` ✅
- 缩略图：`processed/thumbs/{albumId}/{photoId}.jpg` ✅
- 预览图：`processed/previews/{albumId}/{photoId}.jpg` ✅

## ❌ 失败流程

### 场景1: 获取凭证失败
- **前端**: 不创建数据库记录，直接显示错误
- **数据库**: 无记录
- **MinIO**: 无文件
- **Worker**: 无任务

### 场景2: 上传到 MinIO 失败
- **前端**: 
  - 检测到上传失败（网络错误/超时/HTTP错误）
  - 调用 `/api/admin/photos/{id}/cleanup` 清理
  - 更新前端状态为 `failed`
  
- **Cleanup API**:
  - ✅ 删除数据库记录
  - ✅ 清理 MinIO 中的原图文件（如果存在）
  - ✅ 返回成功

- **Worker**:
  - 如果队列中已有任务：
    - ✅ 检查数据库记录不存在 → 直接返回，不重试
    - ✅ 检查文件不存在 → 清理数据库记录（如果还存在）→ 返回，不重试
  - 如果队列中无任务：无影响

### 场景3: Worker 处理失败

#### 3.1 文件不存在（上传失败但记录已创建）
- **Worker**:
  - ✅ 检测到 `NoSuchKey` 错误
  - ✅ 删除数据库记录（如果还存在）
  - ✅ 直接返回，不重试（避免无限重试）

#### 3.2 其他处理错误（图片处理失败等）
- **Worker**:
  - ✅ 更新数据库状态为 `failed`
  - ✅ 抛出错误，触发 BullMQ 重试机制（最多重试3次）
  - ✅ 重试失败后，状态保持为 `failed`

### 场景4: 暂停上传
- **前端**: 
  - 更新状态为 `paused`
  - 从队列中移除
  - 不调用 cleanup（保留数据库记录）
  
- **Worker**: 
  - 如果任务已在队列中，处理时会检查状态
  - 如果状态不是 `pending`，跳过处理

## 🔄 状态一致性保证

### 1. 数据库记录检查
- Worker 处理前检查记录是否存在
- 如果不存在，直接返回，不重试
- 避免处理已清理的记录

### 2. 文件存在性检查
- Worker 下载文件时检查文件是否存在
- 如果不存在，清理数据库记录
- 避免无限重试

### 3. 状态检查
- Worker 处理前检查状态
- 如果状态是 `completed` 或 `failed`，跳过处理
- 避免重复处理

### 4. 清理机制
- Cleanup API 同时清理数据库和 MinIO 文件
- Worker 检测到文件不存在时也清理数据库
- 确保失败时资源完全清理

## 📊 状态映射表

| 阶段 | 数据库状态 | MinIO 文件 | Worker 队列 | 前端显示 |
|------|-----------|-----------|------------|---------|
| 获取凭证成功 | `pending` | 无 | 无 | 上传中 |
| 上传成功 | `pending` | ✅ 原图 | ✅ 任务 | 上传完成，处理中 |
| 处理中 | `processing` | ✅ 原图 | ✅ 处理中 | 处理中 |
| 处理完成 | `completed` | ✅ 原图+缩略图+预览图 | ✅ 完成 | 完成 |
| 上传失败 | 已删除 | 已清理 | 跳过 | 失败 |
| 处理失败 | `failed` | ✅ 原图 | ❌ 失败 | 失败 |

## 🛡️ 错误处理策略

### 前端
- ✅ 上传失败 → 立即清理数据库和文件
- ✅ 显示明确的错误信息
- ✅ 允许用户重试

### Worker
- ✅ 记录不存在 → 跳过处理
- ✅ 文件不存在 → 清理记录，不重试
- ✅ 处理错误 → 更新状态为 `failed`，允许重试
- ✅ 重试失败 → 保持 `failed` 状态

### Cleanup API
- ✅ 幂等操作：多次调用不会出错
- ✅ 同时清理数据库和文件
- ✅ 文件不存在时也返回成功

## 🔍 调试建议

### 检查上传失败
1. 查看前端控制台错误
2. 检查 Cleanup API 是否被调用
3. 检查数据库记录是否已删除
4. 检查 MinIO 文件是否已清理

### 检查处理失败
1. 查看 Worker 日志：`docker logs pis-worker`
2. 检查数据库状态：`SELECT id, status FROM photos WHERE id = 'xxx'`
3. 检查 MinIO 文件是否存在：`mc ls pis-photos/raw/{albumId}/`
4. 检查队列状态：`docker exec pis-redis redis-cli LLEN bull:photo-processing:waiting`

### 恢复卡住的任务
- Worker 启动时会自动恢复卡在 `processing` 状态的照片
- 如果照片已处理完成但状态未更新，会自动修复
- 如果照片未处理完成，会重新加入队列

## 📝 注意事项

1. **上传成功后才触发处理**：避免上传失败时也触发处理请求
2. **清理时同时清理数据库和文件**：确保资源完全清理
3. **Worker 检查记录存在性**：避免处理已清理的记录
4. **幂等操作**：Cleanup API 可以安全地多次调用
5. **状态一致性**：通过检查机制确保四个部分状态一致
