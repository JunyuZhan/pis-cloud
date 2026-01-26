# 上传流程数据同步改进方案

## 问题分析

前端上传失败容易造成数据库、MinIO 和 Worker 之间的工作不同步和不协调。主要问题包括：

### 1. 数据不一致场景

#### 场景 A：数据库记录存在，但文件不存在
- **原因**：前端上传到 MinIO 失败（网络中断、超时等），但数据库记录已创建
- **影响**：Worker 处理时会发现文件不存在，自动清理记录（✅ 已有保护）
- **问题**：如果 Worker 未及时处理，pending 状态会一直存在

#### 场景 B：文件存在，但未触发处理
- **原因**：上传成功但调用 `/api/admin/photos/process` 失败（网络问题、Worker 不可用等）
- **影响**：文件已在 MinIO，但数据库状态是 `pending`，Worker 不会自动处理
- **问题**：照片会一直处于 pending 状态，用户看到"X 张照片正在处理中"

#### 场景 C：前端清理失败
- **原因**：上传失败后，前端调用 cleanup API 失败（网络问题、API 错误等）
- **影响**：数据库记录残留，显示为 pending 状态
- **问题**：需要手动清理或等待 Worker 发现文件不存在

### 2. 现有保护机制

✅ **后端保护**：
- 获取 presigned URL 失败时，后端会清理数据库记录
- Worker 处理时如果文件不存在，会自动清理数据库记录

✅ **前端保护**：
- 上传失败时，前端会调用 cleanup API 清理数据库和 MinIO
- 获取凭证失败时，前端会尝试清理已创建的记录

✅ **Worker 保护**：
- 启动时会恢复卡住的 `processing` 状态照片
- 处理时使用条件更新（状态机锁）避免竞态条件

❌ **缺失的保护**：
- **没有定时扫描 pending 状态的照片**：如果上传成功但触发处理失败，照片会一直 pending
- **没有检查 pending 照片的文件是否存在**：可能数据库有 pending 记录但文件不存在（或相反）

## 改进方案

### 1. Worker 定时扫描 pending 照片

**实现**：添加定时任务，定期扫描 `pending` 状态的照片，检查文件是否存在并自动处理或清理。

**配置**：
```env
# 定时扫描间隔（毫秒），默认 30 秒
PENDING_PHOTO_SCAN_INTERVAL_MS=30000

# 每次扫描的照片数量，默认 50 张
PENDING_PHOTO_SCAN_BATCH_SIZE=50

# 最小年龄（毫秒），默认 10 秒（避免扫描刚创建的记录）
PENDING_PHOTO_MIN_AGE_MS=10000
```

**工作流程**：
1. 每 30 秒执行一次扫描
2. 查询所有 `pending` 状态且超过 10 秒的照片（最多 50 张）
3. 检查队列中是否已有对应任务（避免重复添加）
4. 对每个照片：
   - **文件存在**：重新加入处理队列
   - **文件不存在**：清理数据库记录

**日志输出**：
```
🔍 Scanning pending photos for consistency check...
📋 Found 7 pending photos to check
🔄 Requeued pending photo with existing file: xxx
🧹 Cleaned up pending photo without file: yyy
✅ Pending scan completed: 7 photos processed
   - 5 photos requeued (file exists)
   - 2 photos cleaned (file missing)
```

### 2. 改进前端清理逻辑（可选）

**建议**：增加重试机制和更好的错误处理。

**实现要点**：
- 清理失败时，记录错误但不阻塞用户操作
- 可以添加重试机制（最多 3 次）
- 显示清理状态给用户

## 技术细节

### 文件存在性检查

使用存储适配器的 `exists()` 方法：
```typescript
async function checkFileExists(key: string): Promise<boolean> {
  try {
    const adapter = getStorageAdapter();
    return await adapter.exists(key);
  } catch (err: any) {
    console.warn(`⚠️ Error checking file existence for ${key}:`, err.message);
    return false; // 保守地返回 false
  }
}
```

### 避免重复处理

在重新加入队列前，检查队列中是否已有对应任务：
```typescript
const waitingJobs = await photoQueue.getWaiting();
const activeJobs = await photoQueue.getActive();
const queuedPhotoIds = new Set(
  [...waitingJobs, ...activeJobs].map(job => job.data.photoId)
);

if (queuedPhotoIds.has(photo.id)) {
  continue; // 跳过已在队列中的照片
}
```

## 效果

### 解决的问题

1. ✅ **自动恢复上传成功但未触发的处理**：定时扫描会发现文件存在但状态是 pending 的照片，自动加入处理队列
2. ✅ **自动清理无效记录**：定时扫描会发现文件不存在但状态是 pending 的照片，自动清理数据库记录
3. ✅ **减少手动干预**：不需要手动清理或重新触发处理

### 性能影响

- **触发方式**：事件驱动，只在需要时触发（上传成功但处理失败、上传失败但清理失败）
- **触发频率**：按需触发，不浪费算力
- **资源消耗**：每次检查需要查询数据库和检查文件存在性，但只在必要时执行，影响可忽略

## 优势

### 事件驱动 vs 定时扫描

**事件驱动（当前方案）**：
- ✅ **按需触发**：只在需要时检查，不浪费算力
- ✅ **快速响应**：上传失败后立即补偿，无需等待
- ✅ **精确处理**：只检查相关相册的 pending 照片
- ✅ **资源高效**：没有定时任务占用资源

**定时扫描（已废弃）**：
- ❌ **浪费算力**：即使没有 pending 照片也会定期扫描
- ❌ **延迟响应**：需要等待扫描周期才能发现问题
- ❌ **资源浪费**：定时任务持续运行，占用 CPU 和数据库连接

## 监控建议

建议在日志中监控以下指标：
- 每次扫描发现的 pending 照片数量
- 重新加入队列的照片数量
- 清理的照片数量

如果发现大量 pending 照片，可能需要：
1. 检查 Worker 处理队列是否正常
2. 检查网络连接是否稳定
3. 检查前端上传逻辑是否有问题

## 相关文件

- `services/worker/src/index.ts` - Worker 主文件，包含定时扫描逻辑
- `services/worker/src/lib/storage/index.ts` - 存储适配器，提供 `exists()` 方法
- `apps/web/src/components/admin/photo-uploader.tsx` - 前端上传组件

## 更新日志

- **2026-01-26**：添加定时扫描 pending 照片的机制，解决数据不一致问题
