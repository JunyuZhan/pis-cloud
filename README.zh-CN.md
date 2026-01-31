# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <a href="https://github.com/JunyuZhan/pis-cloud/stargazers">
    <img src="https://img.shields.io/github/stars/JunyuZhan/pis-cloud?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#JunyuZhan/pis-cloud&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date" />
      <img src="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-FF6B6B?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Sharp-图片处理-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <strong>📦 部署版本：</strong>
  <a href="https://github.com/JunyuZhan/pis-cloud">☁️ 云端版本</a> (当前) |
  <a href="https://github.com/JunyuZhan/pis-standalone">🏠 自托管版本</a>
</p>

---

## 🌟 核心功能

### ⚡ **即时交付与同步**
- 分钟级照片交付，实时同步
- FTP/命令行扫描同步，批量导入
- 分片上传，支持大文件

### 🖼️ **高级图片处理**
- 自动 EXIF 旋转 + 手动旋转
- 多尺寸：缩略图（400px）、预览图（2560px）、原图
- BlurHash 占位符，流畅加载
- BullMQ 并行处理（性能提升 13-33%）
- **NEW**: 图片风格预设（13种预设：人像、风景、通用）
  - 为整个相册应用统一的视觉风格
  - 实时预览（使用封面图）
  - 重新处理现有照片以应用新风格
  - 支持单张照片重新处理

### 🎨 **专业展示**
- 精美的瀑布流和网格布局
- 深色界面，移动端优化
- 灯箱模式，键盘导航
- 自定义启动页和动态海报生成

### 🖼️ **水印与保护**
- 最多 6 个水印同时使用
- 文字和 Logo 支持，9 宫格布局
- EXIF 隐私保护（自动移除 GPS）
- 批量水印处理

### 📦 **客户功能**
- 照片选择和批量 ZIP 下载
- **NEW**: 管理员控制的批量下载（默认关闭）
  - 批量下载需要管理员明确开启
  - 生成安全的 presigned URL
  - 一键下载已选照片
- 密码保护和过期时间
- 相册模板和访问统计

### 💰 **灵活部署**
- **架构**: Vercel（前端）+ Supabase（数据库和认证）+ 自建服务器（存储和 Worker）
- **存储**: MinIO、阿里云 OSS、腾讯云 COS、AWS S3
- **数据库**: Supabase 云端
- **认证**: Supabase Auth
- **CDN**: Cloudflare、阿里云、腾讯云
- 配置简单，生产就绪

---

## 🚀 快速开始

### 部署架构

**Vercel + Supabase + 自建 Worker**

- **前端**: 部署到 Vercel（自动）
- **数据库**: Supabase 云端（有免费额度）
- **Worker 和存储**: 自建服务器

### 一键部署

```bash
# 一键安装（复制粘贴到终端执行）
curl -sSL https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | tr -d '\r' | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | tr -d '\r' | bash
```

> 💡 **提示**: `tr -d '\r'` 命令可确保跨系统兼容性，移除 Windows 行尾。脚本本身也包含自动行尾清理机制作为备用方案。

或者手动安装：

```bash
git clone https://github.com/JunyuZhan/pis-cloud.git
cd pis/docker
bash deploy.sh
```

引导程序会完成：
- ✅ 选择部署模式（三选一：混合/半自托管/完全自托管）
- ✅ 自动生成安全密钥
- ✅ 配置存储（MinIO/OSS/COS/S3）
- ✅ 启动所有服务
- ✅ 自动创建管理员账号（完全自托管模式）

> 📖 **详细指南**: [部署文档](docs/i18n/zh-CN/DEPLOYMENT.md)

---

### 本地开发

```bash
pnpm install
pnpm setup
pnpm dev
```

> 📖 **开发指南**: [开发文档](docs/DEVELOPMENT.md)

### 手动部署

<details>
<summary>点击展开手动部署步骤</summary>

#### 1. 配置 Supabase

1. 创建 [Supabase](https://supabase.com) 项目
2. **执行数据库架构**：
   - 进入 Supabase Dashboard → **SQL Editor**
   - 执行数据库迁移（参见部署文档）
   - ✅ 完成！
3. **创建管理员账号**：
   - 进入 Supabase Dashboard → **Authentication** → **Users**
   - 点击 **Add user** → **Create new user**
   - 填写信息：
     - **Email**: 你的管理员邮箱（例如：`admin@example.com`）
     - **Password**: 设置一个强密码
     - ✅ **Auto Confirm User**（勾选此项）
   - 点击 **Create user**
   - ✅ 此账号将用于登录 `/admin/login` 管理后台
4. 在 **Settings** → **API** 复制 API Keys

#### 2. 配置环境变量

**统一配置** (根目录 `.env` 文件):
> ✅ **重要**: PIS 使用**统一的根目录配置**，`apps/web` 和 `services/worker` 都从根目录的 `.env` 读取配置。

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 并填入你的配置
```

**示例 `.env` 文件**:
```bash
# 数据库配置
DATABASE_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project.supabase.co

# 存储配置（默认使用 MinIO）
STORAGE_TYPE=minio
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos

# Worker 服务
NEXT_PUBLIC_WORKER_URL=http://localhost:3001
WORKER_API_KEY=your-secret-api-key

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> 💡 **使用云存储？** 查看 [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md) 了解如何配置阿里云 OSS、腾讯云 COS 或 AWS S3

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
| http://localhost:3000/admin/login | 管理后台（使用在 Supabase 中创建的管理员账号登录） |
| http://localhost:9001 | MinIO 控制台（用户名：`minioadmin`，密码：`minioadmin`） |

> 💡 **首次登录**：使用你在 Supabase **Authentication** → **Users** 中创建的邮箱和密码登录管理后台。

---

## 🌐 生产环境部署

### 选项 1：引导式部署（推荐）

引导式部署脚本提供交互式设置体验，并自动生成所有安全密钥。

```bash
# 克隆项目
git clone https://github.com/JunyuZhan/pis-cloud.git
cd pis

# 运行引导式部署（交互式）
bash docker/deploy.sh
```

脚本会引导你完成：
- ✅ 配置 Supabase（数据库和认证）
- ✅ 自动生成安全密钥（API 密钥、密码）
- ✅ 配置存储（MinIO/OSS/COS/S3）
- ✅ 启动 Worker 和存储服务

**远程服务器部署：**

```bash
# 部署到远程服务器
bash docker/deploy.sh <服务器IP> <SSH用户>
# 示例: bash docker/deploy.sh 192.168.1.100 root
```

> 📖 **部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

### 选项 2：手动部署

1. **配置数据库** - 创建 Supabase 项目
2. **配置存储** - 设置 MinIO 或云存储（OSS/COS/S3）
3. **部署前端** - 部署到 Vercel
4. **部署 Worker** - 在服务器上运行 Docker Compose

> 📖 **详细部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

---

---

## 🏗️ 系统架构

**前端** (Next.js on Vercel) → **Worker** (BullMQ + Sharp) → **存储** (MinIO/OSS/COS/S3)  
**数据库** (Supabase 云端) + **队列** (Redis) + **CDN** (可选)

---

## 🛠️ 常用命令

```bash
pnpm setup      # 引导式部署
pnpm dev        # 启动开发
pnpm build      # 构建生产版本
pnpm docker:up  # 启动 Docker 服务（MinIO + Redis）
pnpm lint       # 运行代码检查
```

---

## 📁 环境变量

关键变量: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `NEXT_PUBLIC_APP_URL`, `WORKER_API_KEY`, `ALBUM_SESSION_SECRET`

**自动生成密钥**: 部署脚本会自动为以下变量生成安全的随机值：
- `STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`（MinIO 凭证）
- `WORKER_API_KEY`（Worker API 认证）
- `ALBUM_SESSION_SECRET`（JWT 会话签名）

> 📖 **完整配置指南**: 查看 [.env.example](.env.example) 了解所有可用选项

---

## 📄 许可证

MIT License © 2026 junyuzhan

查看 [LICENSE](LICENSE) 文件了解详情。

---

## 👤 作者

**junyuzhan**
- 邮箱: junyuzhan@outlook.com
- GitHub: [@junyuzhan](https://github.com/junyuzhan)

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

查看 [AUTHORS.md](AUTHORS.md) 了解贡献者列表。

---

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [MinIO](https://min.io/) - 对象存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [BullMQ](https://docs.bullmq.io/) - 队列管理

---

## 🎨 新功能（最新版本）

### 图片风格预设
为整个相册应用专业的调色风格，提供13种精心调校的预设：
- **人像类**：清新人像、日系人像、写实人像、暖调人像、冷调人像
- **风景类**：自然风景、城市风光、日落风景、清新风景
- **通用类**：标准、高对比、柔和

**功能特点：**
- ✅ 相册级别统一风格应用
- ✅ 实时预览（使用封面图）
- ✅ 重新处理现有照片以应用新风格
- ✅ 支持单张照片重新处理
- ✅ 新上传照片自动应用风格

### 增强的批量下载
- ✅ 管理员控制的批量下载（默认关闭）
- ✅ 安全的 presigned URL 生成
- ✅ 一键下载已选照片

> 📖 **了解更多**：查看 [快速开始指南](./docs/QUICK_START.md) 和 [使用指南](./docs/USER_GUIDE.md)

---

## 📚 更多文档

- **[快速开始指南](./docs/QUICK_START.md)** - 3步上手新功能
- **[使用指南](./docs/USER_GUIDE.md)** - 图片风格预设和批量下载完整指南
- **[实现状态](./docs/IMPLEMENTATION_STATUS.md)** - 功能实现跟踪
- **[移动端优化](./docs/MOBILE_OPTIMIZATION.md)** - 移动端用户体验改进

### 快速开始
- [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md) - 详细的部署步骤（包含一键部署快速开始）

### 开发与安全
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建、代码规范、功能文档和所有功能说明
- [安全指南](docs/SECURITY.md) - 安全最佳实践、部署检查清单和开源前安全检查清单

---

## 🌍 语言

- [English](README.md)
- [中文 (Chinese)](README.zh-CN.md) (当前)

---

## ☕ 支持项目

如果这个项目对你有帮助，欢迎支持项目的持续开发！您的支持将帮助：
- 🐛 更快地修复 Bug
- ✨ 添加新功能
- 📚 完善文档
- 🎨 提升用户体验

<p align="center">
  <table>
    <tr>
      <td align="center">
        <img src="./assets/support/WeChat.jpg" alt="微信支付" width="200" />
        <br />
        <strong>微信支付</strong>
      </td>
      <td align="center" style="padding-left: 30px;">
        <img src="./assets/support/Alipay.jpg" alt="支付宝" width="200" />
        <br />
        <strong>支付宝</strong>
      </td>
    </tr>
  </table>
</p>

<p align="center">
  <strong>请我喝杯茶 ☕</strong>
</p>
