# PIS 文档索引

> 最后更新: 2026-01-27

欢迎查阅 PIS (Private Instant Photo Sharing) 的完整文档。

---

## 📚 文档分类

### 🚀 快速开始

> ⚠️ **注意**: 包含敏感信息的文档（`ENVIRONMENT_VARIABLES.md`, `ARCHITECTURE.md`）不会提交到 Git。  
> 环境变量配置请参考项目根目录的 `.env.example` 文件。

- [架构文档](./ARCHITECTURE.example.md) - 系统架构和组件关系说明
- [部署指南](./i18n/en/DEPLOYMENT.md) - 部署指南（包含管理员账号创建步骤）
- [开发指南](./DEVELOPMENT.md) - 开发环境设置、代码规范、功能文档

> 💡 **首次使用提示**：部署完成后，需要在 Supabase **Authentication** → **Users** 中创建管理员账号，才能登录管理后台。详细步骤请参考[部署指南](./i18n/en/DEPLOYMENT.md#4-create-admin-account)。

---

### 🔒 安全

- [安全最佳实践](./SECURITY.md) - 安全措施和最佳实践

---

## 📖 文档结构

```
docs/
├── README.md                          # 文档索引（本文件）
├── ARCHITECTURE.example.md            # 架构文档（包含快速参考、示例版本，不含敏感信息）
├── ARCHITECTURE.md                    # 原始文档（包含敏感信息，不提交到 Git）
├── ENVIRONMENT_VARIABLES.md           # 原始文档（包含敏感信息，不提交到 Git）
├── DEVELOPMENT.md                     # 开发指南（包含功能说明）
├── SECURITY.md                        # 安全最佳实践（包含 Turnstile 配置、敏感文档管理）
└── i18n/                              # 多语言文档
    └── en/                            # 英文文档
        └── DEPLOYMENT.md              # 部署指南（包含配置说明）
```

---

## 🔍 快速查找

### 按任务查找

**我想...**
- **了解架构** → [架构文档](./ARCHITECTURE.example.md)
- **配置环境变量** → 参考项目根目录 `.env.example` 文件
- **部署 PIS** → [部署指南](./i18n/en/DEPLOYMENT.md)
- **开发功能** → [开发指南](./DEVELOPMENT.md)
- **了解安全** → [安全最佳实践](./SECURITY.md)

---

## 📝 文档贡献

如果你发现文档有错误或需要改进，欢迎提交 Issue 或 Pull Request。

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/junyuzhan/pis)
- [问题反馈](https://github.com/junyuzhan/pis/issues)
- [功能请求](https://github.com/junyuzhan/pis/issues/new)
