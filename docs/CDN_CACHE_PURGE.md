# CDN 缓存清除方案

## 问题描述

当图片在 Cloudflare CDN 缓存 1 年时，如果删除照片，会出现以下问题：

1. **前端不会显示已删除的照片**（因为查询会过滤 `deleted_at IS NULL`）
2. **但 CDN 缓存中可能还能访问**（如果用户知道完整 URL）
3. **30 天后 MinIO 文件被删除**，源站返回 404，但 CDN 缓存可能还在

## 解决方案

### 方案 1：删除时清除 CDN 缓存（推荐）

在删除照片时，调用 Cloudflare API 清除相关图片的 CDN 缓存。

**优点**：
- ✅ 立即清除缓存，确保删除后无法访问
- ✅ 不影响正常访问性能

**缺点**：
- ⚠️ 需要 Cloudflare API Token
- ⚠️ 需要知道 Cloudflare Zone ID

### 方案 2：使用缓存破坏参数

在删除照片时，更新 `updated_at` 字段，图片 URL 中的查询参数会变化，CDN 会重新缓存。

**优点**：
- ✅ 不需要 Cloudflare API
- ✅ 实现简单

**缺点**：
- ⚠️ 如果用户保存了旧 URL，可能还能访问（直到 CDN 缓存过期）

### 方案 3：配置 Cloudflare 缓存规则

配置 Cloudflare 在源站返回 404 时也清除缓存。

**优点**：
- ✅ 自动处理，无需代码修改

**缺点**：
- ⚠️ 需要等待源站返回 404（30 天后）
- ⚠️ 30 天内缓存仍然存在

## 推荐实现：方案 1 + 方案 2 组合

结合两种方案的优势：

1. **删除时立即清除 CDN 缓存**（方案 1）
2. **更新 `updated_at` 作为备用**（方案 2）

## Cloudflare API 配置

### 1. 获取 API Token

1. 登录 Cloudflare Dashboard
2. 进入 **My Profile** → **API Tokens**
3. 点击 **Create Token**
4. 使用 **Edit zone DNS** 模板，或自定义权限：
   - **Zone** → **Zone** → **Edit**
   - **Zone** → **Zone Settings** → **Edit**
   - **Zone** → **Cache Purge** → **Purge**

### 2. 获取 Zone ID

1. 进入 Cloudflare Dashboard
2. 选择你的域名（`media.albertzhan.top`）
3. 在右侧边栏找到 **Zone ID**

### 3. 配置环境变量

```bash
# .env.local 或生产环境变量
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_MEDIA_DOMAIN=media.albertzhan.top
```

## 实现代码

见 `apps/web/src/lib/cloudflare-purge.ts` 和 `apps/web/src/app/api/admin/albums/[id]/photos/route.ts`

## 使用说明

删除照片时，系统会自动：
1. 清除 Cloudflare CDN 缓存
2. 更新 `updated_at` 字段（作为备用）

如果 Cloudflare API 调用失败，`updated_at` 的变化也会使 URL 变化，CDN 会重新缓存（但旧 URL 可能还能访问一段时间）。

## 注意事项

1. **API Token 权限**：确保 Token 有缓存清除权限
2. **速率限制**：Cloudflare API 有速率限制，批量删除时注意
3. **错误处理**：如果清除缓存失败，记录日志但不阻止删除操作
4. **成本**：Cloudflare 免费版每天可以清除 1000 个 URL
