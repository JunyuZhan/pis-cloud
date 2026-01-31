# PIS 脚本工具集

本目录包含 PIS 项目的各种实用脚本工具。

## 📋 脚本列表

### 🚀 部署相关

#### `deploy.sh`
一键部署脚本，支持本地和远程部署。

**用法：**
```bash
# 在服务器上直接运行（推荐）
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash

# 在本地运行，远程部署
bash scripts/deploy.sh <服务器IP> [用户名]
```

#### `setup.sh`
引导式部署脚本，用于本地开发环境设置。

**用法：**
```bash
bash scripts/setup.sh
```

**功能：**
- 本地开发环境设置
- 生产环境部署配置
- Docker 服务管理
- 数据库架构初始化
- 系统状态检查

#### `start-internal-services.sh`
只启动内网容器服务（MinIO、Redis、数据库等），不启动 Worker 和 Web 服务。

**用法：**
```bash
bash scripts/start-internal-services.sh
```

**功能：**
- 自动检测并启动基础服务（MinIO、Redis）
- 根据配置自动选择数据库（PostgreSQL/MySQL）
- 仅启动内网服务，不暴露公网端口
- 显示服务访问信息

**适用场景：**
- 本地开发时只需要存储和数据库服务
- 测试环境只需要基础服务
- 不想启动完整的应用栈

#### `verify-deployment.sh`
部署验证脚本，端到端验证部署是否成功。

**用法：**
```bash
# 本地验证
./scripts/verify-deployment.sh

# 远程验证
./scripts/verify-deployment.sh <SSH_HOST>
```

#### `update-worker-on-server.sh`
Worker 更新脚本，在服务器上拉取最新代码并更新 Worker 服务。

**用法：**
```bash
bash scripts/update-worker-on-server.sh
```

---

### 🔒 安全相关

#### `check-security.sh`
安全检查脚本，用于在提交代码前检查是否有敏感信息泄露风险。

**用法：**
```bash
bash scripts/check-security.sh
```

**检查项：**
- 敏感文件是否被 Git 跟踪
- Git 历史中是否有敏感文件
- 硬编码的 JWT tokens
- Supabase 配置泄露
- AWS Access Keys
- 硬编码密码
- 私人域名泄露
- .gitignore 配置

---

### ☁️ CDN 缓存管理

#### `purge-cloudflare-cache.ts`
Cloudflare CDN 缓存清除工具（整合版）。

**用法：**
```bash
# 手动清除指定 URL
tsx scripts/purge-cloudflare-cache.ts --urls <URL1> <URL2> ...

# 自动清除已删除照片的缓存
tsx scripts/purge-cloudflare-cache.ts --deleted-photos

# 查看帮助
tsx scripts/purge-cloudflare-cache.ts --help
```

**环境变量：**
- `CLOUDFLARE_ZONE_ID` - Cloudflare Zone ID (必需)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token (必需)
- `NEXT_PUBLIC_MEDIA_URL` - 媒体服务器 URL (自动模式需要)
- `SUPABASE_URL` - Supabase URL (自动模式需要)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key (自动模式需要)

**示例：**
```bash
# 清除指定 URL
tsx scripts/purge-cloudflare-cache.ts --urls \
  https://example.com/image1.jpg \
  https://example.com/image2.jpg

# 清除已删除照片的缓存
tsx scripts/purge-cloudflare-cache.ts --deleted-photos
```

---

### 🎨 图标工具

#### `icon-tools.js`
PWA 图标工具集（整合版），支持生成图标和去除水印。

**用法：**
```bash
# 生成 PWA 图标（各种尺寸）
node scripts/icon-tools.js generate

# 去除图标水印
node scripts/icon-tools.js remove-watermark [source-png] [options]

# 查看帮助
node scripts/icon-tools.js --help
```

**选项（remove-watermark）：**
- `--crop-x=<number>` - 裁剪起始 X 坐标
- `--crop-y=<number>` - 裁剪起始 Y 坐标
- `--crop-width=<number>` - 裁剪宽度
- `--crop-height=<number>` - 裁剪高度

**示例：**
```bash
# 生成图标
node scripts/icon-tools.js generate

# 去除水印（使用默认文件）
node scripts/icon-tools.js remove-watermark

# 去除水印（指定文件并裁剪）
node scripts/icon-tools.js remove-watermark icon.png \
  --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492
```

---

### 📚 文档工具

#### `create-example-docs.py`
创建文档的示例版本，用占位符替换敏感信息。

**用法：**
```bash
python3 scripts/create-example-docs.py
```

**功能：**
- 自动检测并替换敏感信息（Supabase URLs、JWT tokens、API keys 等）
- 为文档创建 `.example.md` 版本
- 添加警告信息，提示这是示例文档

---

## 📝 脚本整合说明

为了简化维护，以下脚本已被整合：

### 已整合的脚本

1. **Cloudflare 缓存清除**
   - ❌ `purge-cf-cache.sh` (已删除)
   - ❌ `purge-deleted-photos-cache.ts` (已删除)
   - ✅ `purge-cloudflare-cache.ts` (整合版)

2. **图标处理**
   - ❌ `generate-icons.js` (已删除)
   - ❌ `remove-watermark.js` (已删除)
   - ✅ `icon-tools.js` (整合版)

3. **Worker 管理**
   - ❌ `setup-worker-api-key.sh` (已删除，功能已包含在 `update-worker-on-server.sh` 中)

---

## 🔧 依赖要求

- **Node.js** >= 20.0.0 (用于 TypeScript/JavaScript 脚本)
- **Python** >= 3.6 (用于 Python 脚本)
- **tsx** (用于运行 TypeScript 脚本): `pnpm add -g tsx`
- **sharp** (用于图标处理): 已包含在 `apps/web/node_modules` 中

---

## 📖 相关文档

- [部署指南](../docs/i18n/en/DEPLOYMENT.md)
- [开发指南](../docs/DEVELOPMENT.md)
- [安全指南](../docs/SECURITY.md)
