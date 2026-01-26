# Vercel 环境变量配置检查清单

> 更新时间: 2026-01-26

## 📋 必需配置的环境变量

在 Vercel Dashboard → **Settings** → **Environment Variables** 中配置以下变量：

### 🔴 必需变量（前端）

| 变量名 | 说明 | 示例值 | 当前值 |
|--------|------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` | `https://hapkufkiavhrxxcuzptm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJ...` | ✅ 已配置 |
| `NEXT_PUBLIC_MEDIA_URL` | 媒体服务器 URL（前端访问） | `https://media.yourdomain.com/pis-photos` | `http://media.albertzhan.top/pis-photos` |
| `NEXT_PUBLIC_WORKER_URL` | Worker API URL | `https://worker.yourdomain.com` | `http://worker.albertzhan.top` |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址（生产域名） | `https://yourdomain.com` | ⚠️ 需要配置生产域名 |

### 🔴 必需变量（服务端 API Routes）

| 变量名 | 说明 | 示例值 | 当前值 |
|--------|------|--------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | `eyJ...` | ✅ 已配置 |
| `WORKER_API_KEY` | Worker API 认证密钥 | `随机32字符hex` | ✅ 已配置 |

### 🟡 可选变量（推荐配置）

| 变量名 | 说明 | 示例值 | 当前值 |
|--------|------|--------|--------|
| `NEXT_PUBLIC_PHOTOGRAPHER_NAME` | 摄影师/工作室名称 | `PIS Photography` | `PIS Photography` |
| `NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE` | 标语 | `专业活动摄影` | `专业活动摄影` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile 站点密钥 | `0x4AAAAAAA...` | ✅ 已配置 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 密钥 | `0x4AAAAAAA...` | ✅ 已配置 |
| `NEXT_PUBLIC_LOGO_URL` | 自定义 Logo URL（可选） | `/icons/your-logo.svg` | - |

---

## 🔴 Worker 服务环境变量（独立部署）

**注意**：Worker 服务是独立部署的（不在 Vercel），需要在 Worker 服务的部署环境中配置以下变量：

| 变量名 | 说明 | 默认值 | 示例值 |
|--------|------|--------|--------|
| `PREVIEW_MAX_SIZE` | 预览图最大尺寸（像素） | `1920` | `1920` |
| `THUMB_MAX_SIZE` | 缩略图最大尺寸（像素） | `400` | `400` |

**配置位置**：
- Docker 部署：在 `docker-compose.yml` 的 `worker` 服务环境变量中配置
- 独立服务器部署：在服务器上的 `.env.local` 或系统环境变量中配置

**说明**：
- 这些变量控制图片处理时生成的预览图和缩略图尺寸
- 修改后，已上传的图片不会自动重新生成，需要使用批量重新生成功能
- 默认值已向后兼容，不配置也能正常工作

---

## 🔍 检查步骤

### 1. 登录 Vercel Dashboard
访问：https://vercel.com/dashboard

### 2. 选择项目
找到你的 PIS 项目

### 3. 进入环境变量设置
**Settings** → **Environment Variables**

### 4. 检查以下变量是否存在

#### ✅ 必需检查项：

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - 已配置
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 已配置
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - 已配置
- [ ] `NEXT_PUBLIC_MEDIA_URL` - 已配置（注意：生产环境应使用 HTTPS）
- [ ] `NEXT_PUBLIC_WORKER_URL` - 已配置（注意：生产环境应使用 HTTPS）
- [ ] `NEXT_PUBLIC_APP_URL` - ⚠️ **需要配置为生产域名**（如：`https://photos.albertzhan.top`）
- [ ] `WORKER_API_KEY` - 已配置

#### 🟡 可选检查项：

- [ ] `NEXT_PUBLIC_PHOTOGRAPHER_NAME` - 推荐配置
- [ ] `NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE` - 推荐配置
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - 已配置
- [ ] `TURNSTILE_SECRET_KEY` - 已配置

---

## ⚠️ 重要注意事项

### 1. HTTPS vs HTTP
- **生产环境**：所有 URL 应使用 `https://`
- **当前配置**：`NEXT_PUBLIC_MEDIA_URL` 和 `NEXT_PUBLIC_WORKER_URL` 使用 `http://`
- **建议**：如果域名支持 HTTPS，应改为 `https://`

### 2. 环境作用域
在 Vercel 中配置时，确保选择正确的环境：
- **Production**：生产环境
- **Preview**：预览环境（PR 部署）
- **Development**：开发环境（通常不需要）

### 3. 变量命名
- `NEXT_PUBLIC_*` 开头的变量会暴露到浏览器
- 不要将敏感信息（如 `WORKER_API_KEY`）设置为 `NEXT_PUBLIC_*`

---

## 🔧 快速配置命令（参考）

如果需要通过 Vercel CLI 配置：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 链接项目
vercel link

# 设置环境变量
vercel env add NEXT_PUBLIC_APP_URL production
# 输入值：https://yourdomain.com

vercel env add NEXT_PUBLIC_MEDIA_URL production
# 输入值：https://media.albertzhan.top/pis-photos

vercel env add NEXT_PUBLIC_WORKER_URL production
# 输入值：https://worker.albertzhan.top
```

---

## 📝 当前配置状态

根据本地 `.env.local` 文件，以下变量需要在 Vercel 中配置：

| 变量 | 本地值 | Vercel 应配置值 |
|------|--------|----------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://your-production-domain.com` ⚠️ |
| `NEXT_PUBLIC_MEDIA_URL` | `http://media.albertzhan.top/pis-photos` | `https://media.albertzhan.top/pis-photos` ⚠️ |
| `NEXT_PUBLIC_WORKER_URL` | `http://worker.albertzhan.top` | `https://worker.albertzhan.top` ⚠️ |

**注意**：生产环境应使用 HTTPS，如果域名支持 HTTPS，请更新配置。
