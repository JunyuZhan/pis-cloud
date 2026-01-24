# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <a href="https://github.com/junyuzhan/pis/stargazers">
    <img src="https://img.shields.io/github/stars/junyuzhan/pis?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

---

## 🌟 为什么选择 PIS？

### ⚡ **即时交付**
- **分钟级交付** - 拍摄完成后客户即刻可见照片
- **实时同步** - 基于 Supabase Realtime，上传即见
- **专业工作流** - 流畅的照片交付流程

### 🔒 **完全隐私掌控**
- **私有化部署** - 数据完全掌控，客户隐私安全
- **无第三方依赖** - 所有数据存储在自有服务器
- **合规性** - 适合重视隐私的专业摄影师

### 💰 **成本可控 & 灵活选择**
- **多种存储方案** - 根据需求灵活选择：
  - MinIO（自建，零成本）
  - 阿里云 OSS（国内）
  - 腾讯云 COS（国内）
  - AWS S3（全球）
- **按需付费** - 只为实际使用付费
- **无厂商锁定** - 轻松切换存储提供商

### 🖼️ **高级水印功能**
- **多位置支持** - 最多同时使用 6 个水印
- **9 宫格布局** - 灵活的位置配置
- **文字 & Logo** - 支持文字和图片水印
- **版权保护** - 专业级水印保护

### 🎨 **专业展示**
- **深色界面** - 沉浸式观看体验
- **照片优先设计** - 精美的瀑布流布局
- **移动端优化** - 所有设备完美显示
- **灯箱模式** - 全屏照片查看，支持键盘导航

### 🚀 **生产就绪**
- **一键部署** - Docker Compose 开箱即用
- **自动扩展** - 基于队列的图片处理
- **健康监控** - 内置健康检查端点
- **CI/CD 就绪** - GitHub Actions 集成

### 🔧 **开发者友好**
- **现代技术栈** - Next.js 15、TypeScript、Supabase
- **完善文档** - 中英文详细指南
- **易于扩展** - 模块化架构设计
- **开源免费** - MIT 许可证

---

## ✨ 特性

- 🚀 **即时交付** - 拍摄完成后分钟级交付，客户即刻可见
- 🎨 **专业展示** - 沉浸式深色界面，照片优先的视觉设计
- 🔒 **私有部署** - 数据存储在自有服务器，完全掌控隐私
- 💰 **成本可控** - 支持多种存储方案（MinIO/OSS/COS/S3），灵活选择
- ⚡ **实时同步** - 基于 Supabase Realtime，上传即见
- 🖼️ **智能水印** - 支持文字/Logo 水印，保护作品版权
- 🌍 **多语言支持** - 内置国际化支持（中文、英文）
- 🔌 **灵活扩展** - 支持多种存储和数据库，适应不同部署需求
  - 存储：MinIO、阿里云 OSS、腾讯云 COS、AWS S3
  - 数据库：Supabase、PostgreSQL、MySQL

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────┐            ┌──────────────────────────────┐
│   Vercel 前端     │            │      数据库层 (可选)          │
│   Next.js 15     │◄──────────►│  Supabase / PostgreSQL / MySQL│
│   App Router     │            └──────────────────────────────┘
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    服务器 (Docker)                            │
│  ┌─────────┐    ┌─────────┐    ┌──────────────────────────┐  │
│  │  存储层  │◄───│  Redis  │◄───│  Worker (Sharp 图片处理)  │  │
│  │ MinIO/  │    │  队列   │    │  缩略图/水印/EXIF/BlurHash│  │
│  │ OSS/COS │    │         │    │                          │  │
│  │ /S3     │    │         │    │                          │  │
│  └─────────┘    └─────────┘    └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**支持的存储服务：**
- MinIO（自建，推荐私有部署）
- 阿里云 OSS（国内用户）
- 腾讯云 COS（国内用户）
- AWS S3（海外用户）

**支持的数据库：**
- Supabase（推荐，包含 Auth + Realtime）
- PostgreSQL（原生）
- MySQL（开发中）

---

## 📦 项目结构

```
pis/
├── apps/
│   └── web/                 # Next.js 前端应用
│       ├── src/
│       │   ├── app/         # App Router 页面
│       │   ├── components/  # React 组件
│       │   ├── hooks/       # 自定义 Hooks
│       │   └── lib/         # 工具库
│       └── ...
├── services/
│   └── worker/              # 图片处理 Worker
│       └── src/
│           ├── index.ts     # BullMQ Worker 入口
│           ├── processor.ts # Sharp 图片处理
│           └── lib/         # 存储/数据库客户端
├── database/
│   └── migrations/          # SQL 迁移脚本
├── docker/
│   ├── docker-compose.yml   # Docker 编排
│   ├── worker.Dockerfile    # Worker 镜像
│   └── nginx/               # Nginx 配置
├── docs/                    # 项目文档
└── .env.example             # 环境变量模板
```

---

## 🚀 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- Supabase 账号 ([免费注册](https://supabase.com))

### 一键部署 (推荐)

```bash
# 克隆项目
git clone https://github.com/junyuzhan/pis.git
cd pis

# 安装依赖
pnpm install

# 启动引导式部署
pnpm setup
```

引导程序会自动完成：
- ✅ 检查系统依赖
- ✅ 配置环境变量 (交互式填写 Supabase 凭据)
- ✅ 选择存储类型 (MinIO/OSS/COS/S3)
- ✅ 启动 Docker 服务 (MinIO + Redis)
- ✅ 显示下一步操作指引

> 💡 **提示**：你也可以手动配置存储和数据库类型，详见 [存储配置文档](docs/i18n/zh-CN/STORAGE_CONFIG.md) 和 [数据库配置文档](docs/i18n/zh-CN/DATABASE_CONFIG.md)

### 手动部署

<details>
<summary>点击展开手动部署步骤</summary>

#### 1. 配置 Supabase

1. 创建 [Supabase](https://supabase.com) 项目
2. 在 SQL Editor 中按顺序执行以下迁移文件：
   - `database/migrations/001_init.sql` - 初始化数据库结构
   - `database/migrations/002_secure_rls.sql` - 修复 RLS 安全策略
   - `database/migrations/003_album_features.sql` - 添加相册高级功能
   - `database/migrations/004_album_templates.sql` - 添加相册模板功能（可选）
   - `database/migrations/005_package_downloads.sql` - 添加打包下载功能（可选）
   - `database/migrations/006_album_share_config.sql` - 添加相册分享配置（可选）
   - `database/migrations/007_photo_groups.sql` - 添加相册分组功能（可选）
   - `database/migrations/008_album_event_metadata.sql` - 添加相册活动元数据（可选）
3. 在 Authentication > Users 创建管理员账号
4. 复制 API Keys (Settings → API)

#### 2. 配置环境变量

**前端配置** (`apps/web/.env.local`):
```bash
# 数据库配置
DATABASE_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 存储配置（默认使用 MinIO）
STORAGE_TYPE=minio
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Worker 配置** (`services/worker/.env`):
```bash
# 数据库配置
DATABASE_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 存储配置（默认使用 MinIO）
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
```

> 💡 **使用云存储？** 查看 [存储配置文档](docs/i18n/zh-CN/STORAGE_CONFIG.md) 了解如何配置阿里云 OSS、腾讯云 COS 或 AWS S3

#### 3. 启动服务

```bash
# 启动 Docker 服务
pnpm docker:up

# 启动开发服务器
pnpm dev
```

</details>

### 访问应用

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 首页 |
| http://localhost:3000/admin/login | 管理后台 |
| http://localhost:9001 | MinIO 控制台 |

---

## 🌐 生产部署

### 部署架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  Supabase   │     │   Vercel    │     │   你的服务器         │
│  (数据库)    │     │   (前端)    │     │  (MinIO + Worker)   │
└─────────────┘     └─────────────┘     └─────────────────────┘
```

### 部署步骤

#### 步骤 1: 配置 Supabase (5分钟)

1. [supabase.com](https://supabase.com) → 创建项目
2. SQL Editor → 按顺序执行以下迁移文件：
   - `database/migrations/001_init.sql` - 初始化数据库结构
   - `database/migrations/002_secure_rls.sql` - 修复 RLS 安全策略
   - `database/migrations/003_album_features.sql` - 添加相册高级功能
   - `database/migrations/004_album_templates.sql` - 添加相册模板功能（可选）
   - `database/migrations/005_package_downloads.sql` - 添加打包下载功能（可选）
   - `database/migrations/006_album_share_config.sql` - 添加相册分享配置（可选）
   - `database/migrations/007_photo_groups.sql` - 添加相册分组功能（可选）
   - `database/migrations/008_album_event_metadata.sql` - 添加相册活动元数据（可选）
3. Authentication → Users → 创建管理员账号
4. 记录 Project URL + API Keys

#### 步骤 2: 部署服务器 (10分钟)

```bash
# 上传项目到服务器 /opt/pis/

# 创建环境变量
cat > /opt/pis/.env << EOF
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MINIO_ACCESS_KEY=your-strong-password
MINIO_SECRET_KEY=your-strong-password-8chars
EOF

# 启动服务
cd /opt/pis/docker
docker-compose up -d
```

配置 Nginx 反向代理：`media.yourdomain.com` → `localhost:9000`

#### 步骤 3: 部署 Vercel (5分钟)

1. [vercel.com](https://vercel.com) → 导入 GitHub 仓库
2. Root Directory: `apps/web`
3. 添加环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

4. Deploy → 绑定自定义域名

#### 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看 Worker 日志
docker-compose logs -f worker
```

访问 `https://yourdomain.com/admin/login` 测试登录

> 📖 详细文档: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

---

## 📖 功能说明

### 管理员功能

| 功能 | 描述 |
|------|------|
| 相册管理 | 创建、编辑、删除相册 |
| 相册批量管理 | 批量选择、批量删除多个相册 |
| 相册复制 | 一键复制相册配置，快速创建相同设置的相册 |
| 相册模板 | 创建和管理相册配置模板，快速复用设置 |
| 相册活动元数据 | 设置活动时间和地点，展示在相册封面 |
| 照片上传 | 批量上传，支持 JPG/PNG/HEIC |
| 照片批量管理 | 批量选择、批量删除、快速设置封面 |
| 照片删除 | 单张删除和批量删除照片 |
| 打包下载 | 生成 ZIP 文件，包含有水印和无水印两个版本 |
| 多位置水印 | 支持最多6个水印，可在9个位置灵活配置 |
| 微信分享优化 | 自定义分享卡片（标题、描述、图片） |
| 访问控制 | 公开/私有相册，下载权限 |
| 照片排序 | 手动排序或按拍摄时间 |

### 访客功能

| 功能 | 描述 |
|------|------|
| 相册浏览 | 瀑布流布局，无限滚动 |
| 大图查看 | Lightbox 模式，支持键盘导航 |
| EXIF 显示 | 显示相机参数信息 |
| 原图下载 | 管理员控制的下载权限 |
| 照片选择 | 访客选片，管理员可见 |

---

## 🛠️ 常用命令

```bash
# 部署与配置
pnpm setup           # 启动引导式部署
pnpm docker:up       # 启动 Docker 服务
pnpm docker:down     # 停止 Docker 服务
pnpm docker:logs     # 查看 Docker 日志

# 开发
pnpm dev             # 启动开发服务器
pnpm build           # 构建生产版本
pnpm lint            # 代码检查
pnpm format          # 格式化代码

# 数据库
pnpm db:types        # 生成 Supabase 类型
```

---

## 📁 环境变量说明

### 数据库配置

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DATABASE_TYPE` | 数据库类型: `supabase`(推荐), `postgresql`, `mysql` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL (当使用 Supabase 时) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公开密钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | ✅ |

### 存储配置

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `STORAGE_TYPE` | 存储类型: `minio`(默认), `oss`, `cos`, `s3` | ✅ |
| `STORAGE_ENDPOINT` | 存储服务端点 | ✅ |
| `STORAGE_ACCESS_KEY` | 存储访问密钥 | ✅ |
| `STORAGE_SECRET_KEY` | 存储密钥 | ✅ |
| `STORAGE_BUCKET` | 存储桶名称 | ✅ |
| `NEXT_PUBLIC_MEDIA_URL` | 媒体文件 CDN 地址 | ✅ |

### 应用配置

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `NEXT_PUBLIC_APP_URL` | 应用访问地址 | ✅ |
| `REDIS_*` | Redis 队列配置 | Worker |

> 📖 详细配置指南：
> - [存储配置文档](docs/i18n/zh-CN/STORAGE_CONFIG.md) - 支持 MinIO、阿里云 OSS、腾讯云 COS、AWS S3
> - [数据库配置文档](docs/i18n/zh-CN/DATABASE_CONFIG.md) - 支持 Supabase、PostgreSQL、MySQL

---

## 🔧 常见问题

<details>
<summary><strong>Q: 图片上传后不显示？</strong></summary>

1. 检查 Worker 是否正常运行：`docker-compose logs worker`
2. 确认 MinIO Bucket 权限配置正确
3. 检查 `NEXT_PUBLIC_MEDIA_URL` 是否正确

</details>

<details>
<summary><strong>Q: 登录后一直跳转？</strong></summary>

1. 清除浏览器 Cookies（特别是 `sb-` 开头的）
2. 确认 Supabase Auth 配置中的 Redirect URLs
3. 检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

</details>

<details>
<summary><strong>Q: 如何备份数据？</strong></summary>

```bash
# 备份 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz /data

# Supabase 数据可在 Dashboard 导出
# PostgreSQL: 使用 pg_dump
# MySQL: 使用 mysqldump
```

</details>

<details>
<summary><strong>Q: 如何切换到阿里云 OSS？</strong></summary>

1. 在 `services/worker/.env` 中配置：
```bash
STORAGE_TYPE=oss
STORAGE_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
STORAGE_REGION=cn-hangzhou
STORAGE_ACCESS_KEY=your-access-key-id
STORAGE_SECRET_KEY=your-access-key-secret
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com
STORAGE_USE_SSL=true
```

2. 重启 Worker：`docker-compose restart worker`

详细配置请查看 [存储配置文档](docs/i18n/zh-CN/STORAGE_CONFIG.md)

</details>

<details>
<summary><strong>Q: 支持哪些存储和数据库？</strong></summary>

**存储支持：**
- ✅ MinIO（默认，自建）
- ✅ 阿里云 OSS
- ✅ 腾讯云 COS
- ✅ AWS S3

**数据库支持：**
- ✅ Supabase（推荐，包含 Auth + Realtime）
- 🚧 PostgreSQL（接口已实现）
- 🚧 MySQL（接口已实现）

详细配置请查看：
- [存储配置文档](docs/i18n/zh-CN/STORAGE_CONFIG.md)
- [数据库配置文档](docs/i18n/zh-CN/DATABASE_CONFIG.md)

</details>

---

## 📄 许可证

MIT License © 2026 junyuzhan

查看 [LICENSE](LICENSE) 文件了解详情。

---

## 👤 作者

**junyuzhan**
- 邮箱: junyuzhan@outlook.com
- GitHub: [@junyuzhan](https://github.com/junyuzhan)

## ☕ 支持项目

如果这个项目对你有帮助，欢迎支持项目的持续开发！您的支持将帮助：
- 🐛 更快地修复 Bug
- ✨ 添加新功能
- 📚 完善文档
- 🎨 提升用户体验

<p align="center">
  <img src="https://github.com/junyuzhan/pis/assets/support/wechat-pay.png" alt="微信支付" width="200" />
  <img src="https://github.com/junyuzhan/pis/assets/support/alipay.png" alt="支付宝" width="200" />
</p>

<p align="center">
  <strong>请我喝杯茶 ☕</strong>
</p>

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

查看 [AUTHORS.md](AUTHORS.md) 了解贡献者列表。

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [MinIO](https://min.io/) - 对象存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架

---

## 📚 更多文档

### 快速开始
- [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md) - 详细的部署步骤
- [存储配置](docs/i18n/zh-CN/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 配置指南
- [数据库配置](docs/i18n/zh-CN/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL 配置指南
- [多存储和多数据库支持](docs/i18n/zh-CN/MULTI_STORAGE_DATABASE.md) - 功能说明和迁移指南

### 开发与安全
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建、代码规范和功能文档
- [安全指南](docs/SECURITY.md) - 安全最佳实践、部署检查清单和开源前安全检查清单
- [性能优化](docs/PERFORMANCE_OPTIMIZATION.md) - 性能优化指南

---

## 🌍 语言

- [English](README.md)
- [中文 (Chinese)](README.zh-CN.md) (当前)
