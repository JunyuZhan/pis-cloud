# 照片回收站功能

## 功能概述

实现类似回收站的机制：用户删除照片时，数据库记录被软删除（设置 `deleted_at`），MinIO 文件保留 30 天，到期后自动清理。

## 设计目标

1. **防止误删**：30 天内可以恢复误删的照片
2. **自动清理**：30 天后自动删除 MinIO 文件，释放存储空间
3. **数据一致性**：确保数据库和 MinIO 的同步

## 实现方案

### 1. 数据库变更

**添加 `deleted_at` 字段**：
```sql
ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NOT NULL;
```

**迁移文件**：`database/migrations/add_photo_deleted_at.sql`

### 2. 删除照片流程

**用户删除照片时**：
1. 设置 `deleted_at = NOW()`（软删除）
2. **不删除 MinIO 文件**（保留 30 天）
3. 更新相册照片计数（排除已删除的照片）

**代码位置**：`apps/web/src/app/api/admin/albums/[id]/photos/route.ts`

### 3. 查询过滤

**所有查询照片的 API 都会过滤 `deleted_at IS NULL`**：
- 管理员 API：`/api/admin/albums/[id]/photos`
- 公共 API：`/api/public/albums/[slug]/photos`
- Worker 处理：只处理未删除的照片
- 照片计数：只统计未删除的照片

### 4. 自动清理机制

**Worker 定时任务**：
- **频率**：每小时检查一次（可配置）
- **保留期**：30 天（可配置）
- **处理逻辑**：
  1. 查询所有 `deleted_at` 不为空且超过 30 天的照片
  2. 删除 MinIO 文件（原图、缩略图、预览图）
  3. 删除数据库记录

**配置**：
```env
DELETED_PHOTO_RETENTION_DAYS=30          # 保留天数，默认 30 天
DELETED_PHOTO_CLEANUP_INTERVAL_MS=3600000  # 检查间隔，默认 1 小时
```

**代码位置**：`services/worker/src/index.ts` - `cleanupDeletedPhotos()`

## 工作流程

```
用户删除照片
  ↓
设置 deleted_at = NOW()
  ↓
MinIO 文件保留（不删除）
  ↓
查询时自动过滤（deleted_at IS NULL）
  ↓
30 天后...
  ↓
Worker 定时任务检测到过期
  ↓
删除 MinIO 文件（原图、缩略图、预览图）
  ↓
删除数据库记录
```

## 配置说明

### 环境变量

```env
# 回收站保留天数（默认 30 天）
DELETED_PHOTO_RETENTION_DAYS=30

# 清理检查间隔（默认 1 小时）
DELETED_PHOTO_CLEANUP_INTERVAL_MS=3600000
```

### 调整保留期

如果需要修改保留期：

**生产环境（推荐）**：
```env
DELETED_PHOTO_RETENTION_DAYS=30  # 30 天
```

**开发/测试环境**：
```env
DELETED_PHOTO_RETENTION_DAYS=7   # 7 天（快速测试）
```

**长期保留**：
```env
DELETED_PHOTO_RETENTION_DAYS=90  # 90 天
```

## 恢复照片（未来功能）

如果需要恢复已删除的照片，可以：

1. **手动恢复**（需要数据库访问）：
   ```sql
   UPDATE photos SET deleted_at = NULL WHERE id = 'photo-id';
   ```

2. **API 恢复**（可以添加）：
   ```typescript
   POST /api/admin/photos/[id]/restore
   ```

## 优势

1. ✅ **防止误删**：30 天内可以恢复
2. ✅ **自动清理**：无需手动管理，自动释放存储空间
3. ✅ **性能优化**：查询时自动过滤，不影响性能
4. ✅ **数据一致性**：确保数据库和 MinIO 的同步

## 注意事项

1. **已删除的照片不会显示**：所有查询都会自动过滤 `deleted_at IS NULL`
2. **30 天后无法恢复**：文件会被永久删除
3. **清理是异步的**：删除照片后，文件会在 30 天后被清理，不是立即删除
4. **Worker 必须运行**：如果 Worker 停止运行，过期文件不会被清理

## 相关文件

- `database/migrations/add_photo_deleted_at.sql` - 数据库迁移
- `apps/web/src/app/api/admin/albums/[id]/photos/route.ts` - 删除照片 API
- `services/worker/src/index.ts` - Worker 清理逻辑
- `apps/web/src/app/api/public/albums/[slug]/photos/route.ts` - 公共照片 API

## 更新日志

- **2026-01-26**：实现照片回收站功能，30 天自动清理
