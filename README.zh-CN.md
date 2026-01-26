# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <a href="https://github.com/junyuzhan/pis/stargazers">
    <img src="https://img.shields.io/github/stars/junyuzhan/pis?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#junyuzhan/pis&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date" />
      <img src="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date" alt="Star History Chart" />
    </picture>
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
- **动态海报生成** - 自动生成包含二维码的分享海报，支持自定义样式
- **相册海报图片** - 设置自定义海报图片，提升品牌形象和展示效果

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

## 🚀 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- Supabase 账号 ([免费注册](https://supabase.com))

### 一键部署 (推荐)

```bash
# 克隆项目
git clone https://github.com/JunyuZhan/PIS.git
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
   - `database/migrations/012_album_poster.sql` - 添加相册海报图片URL（可选）
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

## 🌐 生产环境部署

### 一键部署到服务器（推荐）

**SSH 登录到服务器，运行：**

```bash
# 先下载再执行（推荐，支持交互式输入）
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh
```

脚本会引导你完成：
- ✅ 安装 Docker、Docker Compose 和 Git
- ✅ 从 GitHub 克隆最新代码
- ✅ 选择数据库类型（Supabase/PostgreSQL/MySQL）
- ✅ 选择网络模式（公网/内网）
- ✅ 配置并启动所有服务

**或者：从本地远程部署**

```bash
git clone https://github.com/junyuzhan/pis.git
cd pis
bash scripts/deploy.sh 192.168.1.100 root
```

> 📖 **部署指南**: [docs/i18n/zh-CN/ONE_CLICK_DEPLOY.md](docs/i18n/zh-CN/ONE_CLICK_DEPLOY.md)

### 手动部署

1. **配置 Supabase** - 创建项目并执行迁移
2. **部署服务器** - 在服务器上运行 Docker Compose
3. **部署前端** - 部署到 Vercel 或你的托管服务

> 📖 **详细部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

---

---

## 🛠️ 常用命令

```bash
pnpm setup      # 引导式部署
pnpm dev        # 启动开发
pnpm docker:up  # 启动 Docker 服务
```

---

## 📁 环境变量

关键变量: `DATABASE_TYPE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `NEXT_PUBLIC_APP_URL`

> 📖 **完整配置指南**: 查看 [.env.example](.env.example) 和 [存储配置](docs/i18n/zh-CN/STORAGE_CONFIG.md)

---

## 🔧 常见问题

**Q: 图片上传后不显示？**  
检查 Worker 日志: `docker-compose logs worker` 并确认 `NEXT_PUBLIC_MEDIA_URL`

**Q: 登录后一直跳转？**  
清除浏览器 Cookies 并检查 Supabase Auth Redirect URLs

**Q: 如何切换存储？**  
详见 [存储配置](docs/i18n/zh-CN/STORAGE_CONFIG.md)

**Q: 支持哪些存储/数据库？**  
存储: MinIO、OSS、COS、S3 | 数据库: Supabase（推荐）、PostgreSQL、MySQL

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

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [MinIO](https://min.io/) - 对象存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架

---

## 📚 更多文档

### 快速开始
- [一键部署](docs/i18n/zh-CN/ONE_CLICK_DEPLOY.md) - 一条命令部署到服务器
- [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md) - 详细的部署步骤
- [存储配置](docs/i18n/zh-CN/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 配置指南
- [数据库配置](docs/i18n/zh-CN/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL 配置指南
- [多存储和多数据库支持](docs/i18n/zh-CN/MULTI_STORAGE_DATABASE.md) - 功能说明和迁移指南

### 开发与安全
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建、代码规范和功能文档
- [安全指南](docs/SECURITY.md) - 安全最佳实践、部署检查清单和开源前安全检查清单
- [性能优化](docs/PERFORMANCE_OPTIMIZATION.md) - 性能优化指南

### 功能说明
- [相册海报功能](docs/POSTER_FEATURE.md) - 相册海报图片和动态海报生成指南
- [分享图片 URL](docs/SHARE_IMAGE_URL_EXPLANATION.md) - 分享预览图片配置说明

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
