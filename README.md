# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
</p>

---

## ✨ 特性

- 🚀 **即时交付** - 拍摄完成后分钟级交付，客户即刻可见
- 🎨 **专业展示** - 沉浸式深色界面，照片优先的视觉设计
- 🔒 **私有部署** - 数据存储在自有服务器，完全掌控隐私
- 💰 **成本可控** - 利用内网 MinIO 存储，避免云存储高额费用
- ⚡ **实时同步** - 基于 Supabase Realtime，上传即见
- 🖼️ **智能水印** - 支持文字/Logo 水印，保护作品版权

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
│   Vercel 前端     │            │      Supabase Cloud          │
│   Next.js 15     │◄──────────►│  PostgreSQL + Auth + Realtime│
│   App Router     │            └──────────────────────────────┘
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    内网服务器 (Docker)                         │
│  ┌─────────┐    ┌─────────┐    ┌──────────────────────────┐  │
│  │  MinIO  │◄───│  Redis  │◄───│  Worker (Sharp 图片处理)  │  │
│  │ 图片存储 │    │  队列   │    │  缩略图/水印/EXIF/BlurHash│  │
│  └─────────┘    └─────────┘    └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

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
│           └── lib/         # MinIO/Redis 客户端
├── database/
│   └── migrations/          # SQL 迁移脚本
├── docker/
│   ├── docker-compose.yml   # Docker 编排
│   ├── worker.Dockerfile    # Worker 镜像
│   └── nginx/               # Nginx 配置
├── docs/                    # 项目文档
└── env.example              # 环境变量模板
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
- ✅ 启动 Docker 服务 (MinIO + Redis)
- ✅ 显示下一步操作指引

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
3. 在 Authentication > Users 创建管理员账号
4. 复制 API Keys (Settings → API)

#### 2. 配置环境变量

```bash
# 前端配置
cat > apps/web/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
EOF

# Worker 配置
cat > services/worker/.env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
```

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

> 📖 详细文档: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 📖 功能说明

### 管理员功能

| 功能 | 描述 |
|------|------|
| 相册管理 | 创建、编辑、删除相册 |
| 相册批量管理 | 批量选择、批量删除多个相册 |
| 相册复制 | 一键复制相册配置，快速创建相同设置的相册 |
| 相册模板 | 创建和管理相册配置模板，快速复用设置 |
| 照片上传 | 批量上传，支持 JPG/PNG/HEIC |
| 照片批量管理 | 批量选择、批量删除、快速设置封面 |
| 打包下载 | 生成 ZIP 文件，包含有水印和无水印两个版本 |
| 多位置水印 | 支持最多6个水印，可在9个位置灵活配置 |
| 微信分享优化 | 自定义分享卡片（标题、描述、图片） |
| 访问控制 | 公开/私有相册，下载权限 |
| 照片排序 | 手动排序或按拍摄时间 |

> 📖 详细使用指南：[docs/NEW_FEATURES_GUIDE.md](docs/NEW_FEATURES_GUIDE.md)

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

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公开密钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | ✅ |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址 | ✅ |
| `NEXT_PUBLIC_MEDIA_URL` | 媒体文件 CDN 地址 | ✅ |
| `MINIO_*` | MinIO 存储配置 | Worker |
| `REDIS_*` | Redis 队列配置 | Worker |

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
```

</details>

---

## 📄 许可证

MIT License © 2026

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [MinIO](https://min.io/) - 对象存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
