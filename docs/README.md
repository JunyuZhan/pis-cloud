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
- [CDN 配置指南](./CDN_SETUP_GUIDE.md) - Cloudflare/阿里云/腾讯云 CDN 配置（包含缓存清除配置）

---

### 🔒 安全与性能

#### 安全
- [安全最佳实践](./SECURITY.md) - 安全措施、部署检查清单、安全建议

#### 性能优化
- [性能优化指南](./PERFORMANCE_OPTIMIZATION.md) - 系统性能优化方案（包含前端、后端和图片优化）

---

### 🎯 功能文档

- [开发指南](./DEVELOPMENT.md) - 开发环境设置、代码规范、功能文档（包含 Worker、上传、预览图等功能说明）

---

### 🔧 其他文档

- [Turnstile 配置指南](./TURNSTILE_SETUP.md) - Cloudflare Turnstile 完整配置说明

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
├── DEVELOPMENT.md                     # 开发指南（包含功能说明）
├── SECURITY.md                        # 安全最佳实践
├── PERFORMANCE_OPTIMIZATION.md        # 性能优化指南
├── CDN_SETUP_GUIDE.md                 # CDN 配置指南（包含缓存清除）
├── TURNSTILE_SETUP.md                 # Turnstile 配置指南
└── i18n/                              # 多语言文档
    ├── en/                            # 英文文档
    │   ├── DEPLOYMENT.md              # 部署指南（包含环境变量）
    │   ├── STORAGE_CONFIG.md          # 存储配置
    │   ├── DATABASE_CONFIG.md         # 数据库配置
    │   ├── ONE_CLICK_DEPLOY.md        # 一键部署
    │   └── MULTI_STORAGE_DATABASE.md  # 多存储支持
    └── zh-CN/                         # 中文文档
        └── ...                        # 同上
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
- **了解功能** → [开发指南](./DEVELOPMENT.md)

---

## 📝 文档贡献

如果你发现文档有错误或需要改进，欢迎提交 Issue 或 Pull Request。

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/junyuzhan/pis)
- [问题反馈](https://github.com/junyuzhan/pis/issues)
- [功能请求](https://github.com/junyuzhan/pis/issues/new)
