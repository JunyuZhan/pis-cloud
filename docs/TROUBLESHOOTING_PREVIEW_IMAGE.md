# 预览图/缩略图显示问题排查指南

> 更新时间: 2026-01-26

## 🔍 问题现象

修改预览图标准并重新部署 worker 后，发现缩略图或预览图无法显示。

---

## 🛠️ 排查步骤

### 1. 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签页，查找以下错误信息：

```
[PhotoCard] Image load failed (preview_key), trying fallback: thumb_key
[OptimizedImage] Image load failed: ...
```

**如果看到这些日志**：
- ✅ 说明降级机制正在工作
- ✅ 系统正在尝试使用后备图片源
- ⚠️ 如果所有后备方案都失败，说明文件可能不存在

### 2. 检查图片文件是否存在

在浏览器中直接访问图片 URL，检查文件是否存在：

```
https://your-media-url/processed/thumbs/{albumId}/{photoId}.jpg
https://your-media-url/processed/previews/{albumId}/{photoId}.jpg
```

**如果返回 404**：
- 文件不存在，需要重新生成

**如果返回其他错误**：
- 检查存储服务配置（MinIO/S3/OSS/COS）
- 检查 CORS 配置
- 检查 CDN 配置（如果使用）

### 3. 检查数据库记录

检查数据库中照片的 `preview_key` 和 `thumb_key` 字段：

```sql
SELECT id, filename, preview_key, thumb_key, original_key, status 
FROM photos 
WHERE album_id = 'your-album-id'
LIMIT 10;
```

**如果 `preview_key` 或 `thumb_key` 为 NULL**：
- 照片可能未处理完成
- 需要重新处理

**如果字段有值但文件不存在**：
- 文件可能被意外删除
- 需要重新生成预览图

### 4. 检查 Worker 日志

查看 Worker 服务的日志，查找处理错误：

```bash
# 如果使用 Docker
docker logs pis-worker

# 如果直接运行
# 查看控制台输出
```

**常见错误**：
- `FILE_NOT_FOUND`: 原图文件不存在
- `Upload failed`: 上传失败
- `Process failed`: 图片处理失败

---

## 🔧 解决方案

### 方案 1：使用重新生成预览图功能（推荐）

1. 在相册详情页，选择需要重新生成的照片
2. 点击「重新生成预览图」按钮
3. 等待处理完成

**优点**：
- ✅ 不需要修改代码或配置
- ✅ 可以批量处理
- ✅ 使用最新的预览图标准

### 方案 2：检查并修复存储配置

如果文件确实存在但无法访问，检查：

1. **存储服务配置**：
   ```bash
   # 检查 .env.local 中的存储配置
   STORAGE_TYPE=minio
   STORAGE_ENDPOINT=...
   STORAGE_ACCESS_KEY=...
   STORAGE_SECRET_KEY=...
   ```

2. **媒体 URL 配置**：
   ```bash
   NEXT_PUBLIC_MEDIA_URL=https://your-media-url
   ```

3. **CORS 配置**：
   - 确保存储服务允许前端域名访问
   - 检查 CORS 头设置

### 方案 3：手动检查文件

如果使用 MinIO，可以通过 MinIO Console 检查文件：

1. 登录 MinIO Console
2. 导航到 `pis-photos` bucket
3. 检查 `processed/thumbs/` 和 `processed/previews/` 目录
4. 确认文件是否存在

---

## 🐛 常见问题

### Q: 为什么修改预览图标准后，旧图片无法显示？

**A**: 这通常是因为：
1. **文件路径相同**：新旧预览图使用相同的文件路径，新文件覆盖了旧文件
2. **处理失败**：重新处理时失败，导致文件损坏或丢失
3. **配置错误**：存储服务配置错误，导致文件无法访问

**解决方案**：
- 使用「重新生成预览图」功能重新处理旧图片
- 或者依赖自动降级机制（预览图 → 缩略图 → 原图）

### Q: 降级机制不工作怎么办？

**A**: 检查以下几点：

1. **浏览器控制台**：查看是否有 JavaScript 错误
2. **图片 URL**：确认 URL 构建正确
3. **网络请求**：在 Network 标签页检查图片请求状态

如果降级机制不工作，可能是：
- `onError` 回调未正确触发
- `imageKeyIndex` 状态未正确更新
- 图片组件错误处理有问题

### Q: 如何确认降级机制是否工作？

**A**: 在浏览器控制台查看日志：

```javascript
// 应该看到类似这样的日志：
[PhotoCard] Image load failed (processed/previews/...), trying fallback: processed/thumbs/...
[PhotoCard] Photo xxx image keys: { preview_key: '...', thumb_key: '...', ... }
```

如果看到这些日志，说明降级机制正在工作。

### Q: 所有图片都无法显示怎么办？

**A**: 检查以下几点：

1. **媒体 URL 配置**：
   ```bash
   NEXT_PUBLIC_MEDIA_URL=https://your-media-url
   ```

2. **存储服务状态**：
   - 检查存储服务是否正常运行
   - 检查网络连接

3. **CDN 配置**（如果使用）：
   - 检查 CDN 是否正常工作
   - 检查缓存规则

---

## 📝 预防措施

### 1. 修改预览图标准前

1. **备份数据**：确保有数据库和存储的备份
2. **测试环境**：先在测试环境验证
3. **逐步迁移**：不要一次性修改所有图片

### 2. 修改预览图标准后

1. **监控日志**：关注 Worker 处理日志
2. **检查文件**：确认文件正确生成
3. **测试显示**：在前端测试图片显示

### 3. 定期检查

1. **文件完整性**：定期检查文件是否存在
2. **存储使用**：监控存储使用情况
3. **错误日志**：定期查看错误日志

---

## 🔗 相关文档

- [预览图标准配置说明](./PREVIEW_IMAGE_STANDARD.md) - 预览图标准配置
- [Worker 功能清单](./WORKER_FEATURES.md) - Worker 服务功能说明
- [性能优化](./PERFORMANCE_OPTIMIZATION.md) - 性能优化建议
