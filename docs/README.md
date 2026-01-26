# PIS 文档索引

> 最后更新: 2026-01-26

欢迎查阅 PIS (Private Instant Photo Sharing) 的完整文档。

---

## 📚 文档分类

### 🚀 快速开始

- [一键部署指南](./i18n/en/ONE_CLICK_DEPLOY.md) - 在服务器上一键部署 PIS
- [部署指南](./i18n/en/DEPLOYMENT.md) - 详细的部署步骤（Vercel、Docker）
- [开发指南](./DEVELOPMENT.md) - 开发环境设置、代码规范、功能文档

---

### ⚙️ 配置指南

#### 存储配置
- [存储配置指南](./i18n/en/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 配置
- [多存储支持](./i18n/en/MULTI_STORAGE_DATABASE.md) - 多存储和多数据库支持说明

#### 数据库配置
- [数据库配置指南](./i18n/en/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL 配置

#### CDN 配置
- [CDN 配置指南](./CDN_SETUP_GUIDE.md) - Cloudflare/阿里云/腾讯云 CDN 配置

---

### 🔒 安全与性能

#### 安全
- [安全最佳实践](./SECURITY.md) - 安全措施、部署检查清单、安全建议

#### 性能优化
- [性能优化指南](./PERFORMANCE_OPTIMIZATION.md) - 系统性能优化方案
- [Worker 性能优化](./WORKER_PERFORMANCE_OPTIMIZATION.md) - Worker 服务性能优化
- [前端图片性能优化](./FRONTEND_IMAGE_PERFORMANCE_OPTIMIZATION.md) - 前端图片加载优化

---

### 🎯 功能文档

- [Worker 功能清单](./WORKER_FEATURES.md) - Worker 服务的完整功能说明
- [海报功能](./POSTER_FEATURE.md) - 相册海报图片和动态海报生成
- [分享图片 URL](./SHARE_IMAGE_URL_EXPLANATION.md) - 分享预览图配置
- [扫描同步功能](./SCAN_SYNC_FEATURE.md) - 扫描和同步功能说明
- [上传协调](./UPLOAD_COORDINATION.md) - 上传流程协调说明
- [上传性能优化](./UPLOAD_PERFORMANCE_OPTIMIZATION.md) - 上传性能优化方案

---

### 🔧 其他文档

- [MinIO 上传指南](./MINIO_UPLOAD_GUIDE.md) - MinIO 存储上传配置
- [Worker API Key 设置](./WORKER_API_KEY_SETUP.md) - Worker API 密钥配置
- [Worker 安全修复](./WORKER_SECURITY_FIX.md) - Worker 安全修复记录
- [Turnstile 配置指南](./TURNSTILE_SETUP.md) - Cloudflare Turnstile 完整配置说明
- [Turnstile 快速开始](./TURNSTILE_QUICK_START.md) - Turnstile 快速配置（3步）
- [视频支持评估](./VIDEO_SUPPORT_EVALUATION.md) - 视频功能支持评估

---

## 🌍 多语言文档

文档提供英文和中文版本：

- **英文**: `docs/i18n/en/`
- **中文**: `docs/i18n/zh-CN/`

---

## 📖 文档结构

```
docs/
├── README.md                          # 文档索引（本文件）
├── DEVELOPMENT.md                     # 开发指南
├── SECURITY.md                        # 安全最佳实践
├── PERFORMANCE_OPTIMIZATION.md        # 性能优化指南
├── CDN_SETUP_GUIDE.md                 # CDN 配置指南
├── WORKER_PERFORMANCE_OPTIMIZATION.md # Worker 性能优化
├── FRONTEND_IMAGE_PERFORMANCE_OPTIMIZATION.md # 前端性能优化
├── WORKER_FEATURES.md                 # Worker 功能清单
├── POSTER_FEATURE.md                  # 海报功能
├── ...                                # 其他功能文档
└── i18n/                              # 多语言文档
    ├── en/                            # 英文文档
    │   ├── DEPLOYMENT.md
    │   ├── STORAGE_CONFIG.md
    │   ├── DATABASE_CONFIG.md
    │   ├── ONE_CLICK_DEPLOY.md
    │   └── MULTI_STORAGE_DATABASE.md
    └── zh-CN/                         # 中文文档
        ├── DEPLOYMENT.md
        ├── STORAGE_CONFIG.md
        ├── DATABASE_CONFIG.md
        ├── ONE_CLICK_DEPLOY.md
        └── MULTI_STORAGE_DATABASE.md
```

---

## 🔍 快速查找

### 按任务查找

**我想...**
- **部署 PIS** → [一键部署指南](./i18n/en/ONE_CLICK_DEPLOY.md) 或 [部署指南](./i18n/en/DEPLOYMENT.md)
- **配置存储** → [存储配置指南](./i18n/en/STORAGE_CONFIG.md)
- **配置数据库** → [数据库配置指南](./i18n/en/DATABASE_CONFIG.md)
- **配置 CDN** → [CDN 配置指南](./CDN_SETUP_GUIDE.md)
- **优化性能** → [性能优化指南](./PERFORMANCE_OPTIMIZATION.md)
- **了解安全** → [安全最佳实践](./SECURITY.md)
- **开发功能** → [开发指南](./DEVELOPMENT.md)
- **了解 Worker** → [Worker 功能清单](./WORKER_FEATURES.md)

---

## 📝 文档贡献

如果你发现文档有错误或需要改进，欢迎提交 Issue 或 Pull Request。

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/junyuzhan/pis)
- [问题反馈](https://github.com/junyuzhan/pis/issues)
- [功能请求](https://github.com/junyuzhan/pis/issues/new)
