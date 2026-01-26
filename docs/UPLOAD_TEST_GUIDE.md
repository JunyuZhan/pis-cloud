# 上传功能测试指南

## 🚀 快速开始

### 1. 获取认证 Cookie

在浏览器中：
1. 访问 `https://pic.albertzhan.top/admin` 并登录
2. 打开开发者工具 (F12)
3. 切换到 **Network** 标签
4. 刷新页面，找到任意 API 请求
5. 查看 **Request Headers** → **Cookie**
6. 复制整个 Cookie 值（例如：`sb-xxx-auth-token=xxx; sb-xxx-access-token=xxx`）

### 2. 设置环境变量

```bash
export AUTH_COOKIE="你的Cookie值"
export NEXT_PUBLIC_APP_URL="https://pic.albertzhan.top"  # 可选，默认就是这个
```

### 3. 运行测试

#### 完整上传流程测试
```bash
./scripts/test-upload.sh <album_id> <image_path>

# 示例
./scripts/test-upload.sh 550e8400-e29b-41d4-a716-446655440000 /path/to/image.jpg
```

#### API 端点测试
```bash
./scripts/test-upload-api.sh <album_id>

# 示例
./scripts/test-upload-api.sh 550e8400-e29b-41d4-a716-446655440000
```

## 📋 测试脚本说明

### `test-upload.sh` - 完整上传流程测试

测试完整的上传流程：
1. ✅ 获取上传凭证
2. ✅ 上传文件到 MinIO
3. ✅ 触发 Worker 处理
4. ✅ 检查照片状态

**用法**:
```bash
./scripts/test-upload.sh <album_id> [image_path]
```

**参数**:
- `album_id` (必需): 相册 ID
- `image_path` (可选): 图片文件路径，如果不提供会自动创建测试图片

**示例**:
```bash
# 使用真实图片
export AUTH_COOKIE="sb-xxx-auth-token=xxx"
./scripts/test-upload.sh 550e8400-e29b-41d4-a716-446655440000 ~/Pictures/test.jpg

# 使用自动生成的测试图片
./scripts/test-upload.sh 550e8400-e29b-41d4-a716-446655440000
```

### `test-upload-api.sh` - API 端点测试

测试各个 API 端点是否正常工作：
1. ✅ 获取上传凭证 API
2. ✅ 检查 pending 照片 API
3. ✅ 获取照片列表 API

**用法**:
```bash
./scripts/test-upload-api.sh <album_id>
```

## 🔍 测试结果解读

### 成功情况

```
✅ 获取上传凭证成功
✅ 文件上传成功
✅ 处理任务已提交
✅ 照片记录已创建 (状态: pending)
```

### 常见错误

#### 1. 认证失败 (HTTP 401)
```
❌ 获取上传凭证失败 (HTTP 401)
```

**解决方法**:
- 检查 `AUTH_COOKIE` 是否正确设置
- 确认 Cookie 是否过期（需要重新登录）
- 检查 Cookie 格式是否正确（应该包含完整的 Cookie 字符串）

#### 2. 相册不存在 (HTTP 404)
```
❌ 获取上传凭证失败 (HTTP 404)
响应: {"error":{"code":"ALBUM_NOT_FOUND","message":"相册不存在"}}
```

**解决方法**:
- 检查相册 ID 是否正确
- 确认相册未被删除

#### 3. 上传失败 (HTTP 403/500)
```
❌ 上传失败 (HTTP 403)
```

**可能原因**:
- Presigned URL 已过期
- Worker 服务不可用
- MinIO 配置问题

## 🧪 手动测试步骤

如果脚本测试有问题，可以手动测试：

### 步骤 1: 获取上传凭证
```bash
curl -X POST https://pic.albertzhan.top/api/admin/albums/{album_id}/upload \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "filename": "test.jpg",
    "contentType": "image/jpeg",
    "fileSize": 1024000
  }'
```

### 步骤 2: 上传文件
```bash
# 使用返回的 uploadUrl
curl -X PUT "{uploadUrl}" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@/path/to/image.jpg"
```

### 步骤 3: 触发处理
```bash
curl -X POST https://pic.albertzhan.top/api/admin/photos/process \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "photoId": "{photo_id}",
    "albumId": "{album_id}",
    "originalKey": "{original_key}"
  }'
```

## 📊 测试检查清单

- [ ] 获取上传凭证成功
- [ ] 文件上传到 MinIO 成功
- [ ] 数据库记录创建（状态: pending）
- [ ] Worker 处理任务提交成功
- [ ] 照片出现在管理后台列表中
- [ ] Worker 处理完成（状态变为 completed）
- [ ] 缩略图和预览图生成成功

## 🔧 故障排查

### 问题 1: Cookie 格式错误

**错误**: `UNAUTHORIZED` 或 `AUTH_ERROR`

**解决**:
```bash
# 错误的格式（只有部分值）
export AUTH_COOKIE="auth-token=xxx"

# 正确的格式（完整的 Cookie 字符串）
export AUTH_COOKIE="sb-xxx-auth-token=xxx; sb-xxx-access-token=xxx; ..."
```

### 问题 2: 上传超时

**错误**: `上传超时`

**解决**:
- 检查网络连接
- 检查 Worker 服务是否正常运行
- 检查 MinIO 服务是否可访问

### 问题 3: 处理任务未触发

**错误**: 文件上传成功但状态一直是 pending

**解决**:
```bash
# 手动触发检查 pending 照片
curl -X POST https://pic.albertzhan.top/api/admin/albums/{album_id}/check-pending \
  -H "Cookie: $AUTH_COOKIE"
```

## 📝 注意事项

1. **Cookie 有效期**: Cookie 可能会过期，如果测试失败，尝试重新登录并更新 Cookie
2. **速率限制**: API 有速率限制（20次/分钟），如果频繁测试可能会被限制
3. **文件大小**: 测试文件建议小于 10MB，避免上传时间过长
4. **HTTPS**: 生产环境使用 HTTPS，确保 curl 支持 SSL

## 🎯 快速测试命令

```bash
# 一键测试（需要先设置 AUTH_COOKIE）
export AUTH_COOKIE="你的Cookie值"
./scripts/test-upload.sh <album_id> /path/to/image.jpg
```
