# 数据库、Worker、MinIO 协调检查报告

## 📋 系统架构概述

系统由三个核心组件组成：
1. **数据库（Supabase）**：存储照片元数据和状态
2. **Worker 服务**：处理照片（水印、缩略图、预览图）
3. **MinIO 存储**：存储实际文件（raw、processed/thumbs、processed/previews）

---

## ✅ 协调机制检查

### 1. 上传流程协调

**流程**：
```
前端上传请求 → 数据库创建 pending 记录 → Worker 生成 presigned URL 
→ 前端直接上传到 MinIO → 前端触发 Worker 处理
```

**协调点**：
- ✅ **数据库**：在 `/api/admin/albums/[id]/upload` 中创建 `status: 'pending'` 记录
- ✅ **Worker**：在 `/api/worker/presign` 中生成 presigned URL
- ✅ **MinIO**：前端使用 presigned URL 直接上传（PUT 请求）
- ✅ **前端**：上传成功后调用 `/api/admin/photos/process` 触发 Worker 处理

**潜在问题**：
- ⚠️ 如果前端上传到 MinIO 失败，但数据库记录已创建，需要清理机制
- ⚠️ 如果前端没有正确触发 `/api/admin/photos/process`，照片会一直处于 pending 状态

---

### 2. 处理流程协调

**流程**：
```
Worker 从队列获取任务 → 原子更新 pending → processing 
→ 从 MinIO 读取原图 → 处理（水印、缩略图、预览图） 
→ 上传处理后的文件到 MinIO → 更新数据库为 completed
```

**协调点**：
- ✅ **原子状态更新**：使用 `UPDATE ... WHERE status='pending'` 防止竞态条件
- ✅ **文件读取**：从 MinIO 读取 `original_key` 对应的文件
- ✅ **文件写入**：处理后写入 `processed/thumbs/` 和 `processed/previews/`
- ✅ **数据库更新**：更新 `status: 'completed'` 并记录 `thumb_key`、`preview_key`

**错误处理**：
- ✅ 如果文件不存在（`NoSuchKey`），删除数据库记录
- ✅ 如果处理失败，更新 `status: 'failed'`
- ✅ 如果记录不存在，跳过处理（可能已被清理）

---

### 3. 清理机制协调

**场景 1：上传失败清理**

**流程**：
```
前端上传失败 → 调用 /api/admin/photos/[id]/cleanup 
→ 删除数据库记录 → 删除 MinIO 文件（如果存在）
```

**协调点**：
- ✅ **前端**：在 `photo-uploader.tsx` 中调用 cleanup API
- ✅ **数据库**：删除 pending 或 failed 状态的记录
- ✅ **MinIO**：删除 `original_key` 对应的文件
- ✅ **Worker 队列**：任务会自动跳过（因为记录不存在）

**限制**：
- ⚠️ 只能清理 `pending` 或 `failed` 状态的照片
- ⚠️ `processing` 状态的照片不能清理（正在处理中）

---

**场景 2：Worker 自动清理**

**流程**：
```
Worker 处理时发现文件不存在 → 删除数据库记录
```

**协调点**：
- ✅ Worker 在 `catch` 块中检查 `NoSuchKey` 错误
- ✅ 如果文件不存在，删除数据库记录
- ✅ 不抛出错误，避免重试（文件不存在时重试也没用）

---

**场景 3：定期检查 pending 和孤立文件**

**流程**：
```
前端调用 /api/admin/albums/[id]/check-pending 
→ Worker 检查 pending 照片 → 检查孤立文件
```

**协调点**：
- ✅ **检查 pending 照片**：
  - 如果文件存在但状态是 pending，重新加入队列
  - 如果文件不存在，清理数据库记录
- ✅ **检查孤立文件**：
  - 如果 MinIO 中有文件但数据库没有记录，创建数据库记录并加入队列
  - 如果数据库记录存在但 `original_key` 不匹配，更新记录

---

## 🔍 发现的问题

### 问题 1：相册 721403cc-57de-4f5b-a4d6-389e876cb72a 没有照片

**现象**：
- MinIO `raw/721403cc-57de-4f5b-a4d6-389e876cb72a/` 目录为空
- Worker 多次检查但未发现 pending 照片
- 前端显示上传进度 100%，但相册中没有照片

**可能原因**：
1. 前端上传到 MinIO 失败（但前端误报成功）
2. presigned URL 的域名（`media.albertzhan.top`）无法从浏览器访问
3. 文件上传成功，但前端没有正确触发 Worker 处理
4. 文件上传成功，但数据库记录被清理了

**建议**：
- 检查浏览器控制台是否有错误信息（CORS、网络错误等）
- 检查 presigned URL 是否可以访问
- 检查前端是否正确触发了 `/api/admin/photos/process`

---

### 问题 2：Worker 日志显示 "Presign error: Error: aborted"

**现象**：
- Worker 日志中出现 `Presign error: Error: aborted`
- 错误代码：`ECONNRESET`

**可能原因**：
- 客户端在获取 presigned URL 时连接被重置
- 可能是网络问题或超时

**建议**：
- 检查网络连接稳定性
- 检查 Worker 服务的响应时间
- 检查是否有防火墙或代理问题

---

## ✅ 协调机制验证

### 1. 状态机一致性

**状态流转**：
```
pending → processing → completed
pending → failed（处理失败）
pending → deleted（清理）
```

**验证**：
- ✅ Worker 使用原子操作更新状态（`UPDATE ... WHERE status='pending'`）
- ✅ 防止竞态条件（多个 Worker 同时处理同一张照片）
- ✅ 状态流转是单向的（不会从 completed 回到 pending）

---

### 2. 数据一致性

**验证**：
- ✅ 数据库记录和 MinIO 文件的一致性通过 `check-pending` 机制保证
- ✅ 孤立文件（MinIO 有文件但数据库没有记录）会被自动恢复
- ✅ 丢失文件（数据库有记录但 MinIO 没有文件）会被自动清理

---

### 3. 错误恢复机制

**验证**：
- ✅ 上传失败时，前端调用 cleanup API 清理数据库和 MinIO
- ✅ Worker 处理时发现文件不存在，自动删除数据库记录
- ✅ 定期检查 pending 照片和孤立文件，自动修复不一致

---

## 📊 统计信息

**MinIO 文件统计**：
- Raw 文件：116 个
- Processed/Thumbs 文件：115 个

**Worker 处理状态**：
- ✅ 最近处理的多张照片都成功完成
- ✅ 水印处理正常
- ⚠️ 相册 721403cc-57de-4f5b-a4d6-389e876cb72a 的文件被清理

---

## 🎯 建议

### 1. 增强上传错误检测

**建议**：
- 在前端添加更详细的错误日志
- 检查 presigned URL 上传的实际响应状态
- 添加上传重试机制

---

### 2. 增强监控和告警

**建议**：
- 监控 pending 状态照片的数量
- 监控孤立文件的数量
- 监控 Worker 处理失败率

---

### 3. 优化协调机制

**建议**：
- 考虑添加事务机制（如果可能）
- 考虑添加分布式锁（如果多个 Worker 实例）
- 考虑添加重试机制（对于网络错误）

---

## 📝 总结

**协调机制总体评价**：✅ **良好**

**优点**：
- ✅ 状态机设计合理，防止竞态条件
- ✅ 错误恢复机制完善（cleanup、check-pending）
- ✅ 孤立文件自动恢复机制

**需要改进**：
- ⚠️ 上传错误检测需要增强
- ⚠️ 监控和告警需要完善
- ⚠️ 需要更好的日志记录和追踪

**当前问题**：
- 🔴 相册 721403cc-57de-4f5b-a4d6-389e876cb72a 没有照片，需要进一步调查上传失败的原因

---

## 🔧 已修复的问题

### 问题：时序问题（Race Condition）

**问题描述**：
- 前端上传到 MinIO 成功后，立即触发 Worker 处理
- 如果 Worker 检查文件时，文件还没完全写入（MinIO 最终一致性），会误删数据库记录
- 导致照片上传成功但数据库记录被清理

**修复方案**：
1. **check-pending 函数**：
   - 如果文件不存在，检查照片的创建时间
   - 如果是最近创建的（30秒内），等待5秒后重试一次
   - 只有在照片创建时间超过30秒且文件不存在时，才清理数据库记录

2. **Worker 处理时的文件不存在错误处理**：
   - 如果文件不存在，检查照片的创建时间
   - 如果是最近创建的（30秒内），等待5秒后重试一次
   - 如果重试后文件存在，重新抛出错误让 BullMQ 重试处理

3. **下载文件时的错误处理**：
   - 如果文件不存在，检查照片的创建时间
   - 如果是最近创建的（30秒内），等待5秒后重试一次
   - 如果重试后文件仍然不存在，才清理数据库记录

**修复效果**：
- ✅ 防止 MinIO 最终一致性问题导致误删数据库记录
- ✅ 给文件上传和写入足够的时间
- ✅ 避免时序问题（Race Condition）
