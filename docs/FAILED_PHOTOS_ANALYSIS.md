# 失败照片分析报告

## 问题概述

发现 6 张照片处理失败，状态为 `failed`。

## 失败照片列表

| ID | 文件名 | 相册ID | 创建时间 | 更新时间 |
|---|---|---|---|---|
| fa458c9f-7106-4e7e-b42c-a76d5dee356a | DSC01350.jpg | 429544d6-8cc6-4c46-915e-015d1baa634d | 2026-01-27 16:27:47 | 2026-01-27 16:27:53 |
| d337c3b3-5709-4128-aa75-c8b6788577fc | DSC02540.jpg | a619bde8-604a-48ec-a9bd-f517bbde8113 | 2026-01-27 16:57:38 | 2026-01-27 16:59:41 |
| 73c293f0-ecf7-474a-ad76-72c35031696c | DSC03781.jpg | a619bde8-604a-48ec-a9bd-f517bbde8113 | 2026-01-27 16:57:38 | 2026-01-27 16:59:41 |
| 375de808-44e6-4871-b02d-a427526dbcd6 | DSC04488.jpg | a619bde8-604a-48ec-a9bd-f517bbde8113 | 2026-01-27 16:57:38 | 2026-01-27 16:59:41 |
| 892917b1-62d0-476d-bcc5-9643ed8bcb40 | DSC02533.jpg | a619bde8-604a-48ec-a9bd-f517bbde8113 | 2026-01-27 16:57:38 | 2026-01-27 16:59:42 |
| baac4895-7541-4420-8058-f3fb9aee1c9f | DSC01136.jpg | a619bde8-604a-48ec-a9bd-f517bbde8113 | 2026-01-27 16:57:38 | 2026-01-27 16:59:41 |

## 根本原因

### 已确认的问题

1. **原始文件不存在**: 所有失败照片的原始文件在 MinIO 中不存在
2. **处理快速失败**: 创建时间和更新时间非常接近（几秒内），说明处理很快失败
3. **状态未正确清理**: 文件不存在时，应该删除数据库记录，但实际状态是 `failed`

### 错误处理逻辑分析

根据代码逻辑（`services/worker/src/index.ts:353-410` 和 `548-600`），当文件不存在时：

1. **下载阶段**（353-410行）:
   - 检测到文件不存在错误
   - 如果照片创建时间 < 30秒: 等待5秒后重试
   - 如果照片创建时间 >= 30秒: 删除数据库记录并返回（不抛出错误）

2. **异常处理阶段**（548-600行）:
   - 如果错误是文件不存在: 删除数据库记录
   - 如果错误是其他类型: 更新状态为 `failed` 并抛出错误

### 问题所在

这些照片的状态是 `failed` 而不是被删除，说明：

1. **错误检测不完整**: 错误处理逻辑只检查了部分错误格式：
   ```typescript
   const isFileNotFound = err?.code === 'NoSuchKey' || 
                         err?.message?.includes('does not exist') ||
                         err?.message?.includes('NoSuchKey');
   ```
   
   但 MinIO 可能返回其他格式的错误，例如：
   - `code: 'NotFound'`
   - `statusCode: 404`
   - `message: 'Unable to stat ...'`
   - `message: 'Object does not exist'`

2. **错误被误判**: 文件不存在的错误被当作其他错误处理，导致状态被设置为 `failed` 而不是删除记录

## 解决方案

### 1. 改进错误检测逻辑 ✅

已更新 `services/worker/src/index.ts`，改进错误检测以支持更多错误格式：

```typescript
const isFileNotFound = err?.code === 'NoSuchKey' || 
                      err?.code === 'NotFound' ||
                      err?.statusCode === 404 ||
                      err?.message?.includes('does not exist') ||
                      err?.message?.includes('NoSuchKey') ||
                      err?.message?.includes('not found') ||
                      err?.message?.includes('NotFound') ||
                      err?.message?.includes('Unable to stat') ||
                      err?.message?.includes('Object does not exist') ||
                      err?.message === 'FILE_NOT_FOUND';
```

### 2. 清理现有失败照片

创建了清理脚本 `scripts/cleanup-failed-photos.ts`，可以清理文件不存在的失败照片。

**使用方法**:
```bash
tsx scripts/cleanup-failed-photos.ts
```

**清理逻辑**:
- 查询所有 `failed` 状态的照片
- 如果照片创建时间超过 1 小时，清理数据库记录
- 如果照片创建时间 < 1 小时，保留（可能是临时错误）

### 3. 预防措施

1. **改进日志记录**: 记录完整的错误信息，包括错误代码、状态码、消息等
2. **添加监控**: 监控失败照片数量，及时发现异常
3. **定期清理**: 定期运行清理脚本，清理文件不存在的失败照片

## 建议操作

1. **立即清理**: 运行清理脚本清理这 6 张失败的照片
2. **部署修复**: 部署改进后的错误处理逻辑
3. **监控**: 观察后续是否有类似问题

## 相关文件

- `services/worker/src/index.ts`: Worker 主逻辑，包含错误处理
- `scripts/cleanup-failed-photos.ts`: 清理脚本
- `docs/FAILED_PHOTOS_ANALYSIS.md`: 本文档
