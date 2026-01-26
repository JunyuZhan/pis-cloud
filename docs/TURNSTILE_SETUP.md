# Cloudflare Turnstile 配置指南

**最后更新**: 2026-01-26

---

## 📋 概述

Cloudflare Turnstile 是一个免费的、隐私友好的验证码服务，用于防止机器人攻击。本项目使用 **Invisible 模式**，用户完全无感知，体验最佳。

---

## 🚀 快速开始

### 1. 创建 Turnstile 站点

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 登录你的 Cloudflare 账号（如果没有账号，免费注册）
3. 导航到 **Turnstile** → **Add Site**
   - 如果找不到，直接访问：https://dash.cloudflare.com/?to=/:account/turnstile
4. 填写站点信息：
   - **Site name**: 你的站点名称（如 "PIS Admin Login"）
   - **Domain**: 你的域名（如 `yourdomain.com`）
     - 本地开发可以填写：`localhost` 或 `127.0.0.1`
   - **Widget Mode**: 选择 **Invisible**（推荐）或 **Managed**
5. 点击 **Create**
6. 获取两个密钥：
   - **Site Key**（公开密钥，用于前端）- 在站点详情页面顶部
   - **Secret Key**（私密密钥，用于后端验证）- 点击 "Reveal" 显示后复制

**详细步骤**：参见 [如何获取 Turnstile 密钥](./TURNSTILE_GET_KEYS.md)

### 2. 配置环境变量

在 `.env.local` 文件中添加：

```bash
# Cloudflare Turnstile (可选)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key-here
TURNSTILE_SECRET_KEY=your-secret-key-here
```

### 3. 重启开发服务器

```bash
pnpm dev
```

---

## ✅ 验证配置

### 检查前端

1. 访问登录页面：`http://localhost:3000/admin/login`
2. 打开浏览器开发者工具 → Network
3. 查看是否有请求到 `challenges.cloudflare.com`
4. 如果看到请求，说明 Turnstile 已加载

### 检查后端

1. 尝试登录
2. 查看服务器日志，应该看到 Turnstile 验证请求
3. 如果验证失败，会返回错误信息

---

## 🔧 工作原理

### Invisible 模式流程

1. **页面加载**：Turnstile 脚本自动加载
2. **后台验证**：Turnstile 在后台分析用户行为
3. **自动执行**：如果判断为正常用户，自动生成 token
4. **提交表单**：token 随登录请求一起发送
5. **服务端验证**：后端调用 Cloudflare API 验证 token

### 用户体验

- ✅ **完全无感知**：用户看不到任何验证界面
- ✅ **无需操作**：不需要点击、滑动或输入
- ✅ **自动验证**：页面加载时自动完成

---

## 🛡️ 安全特性

### 已实施的安全措施

1. **服务端验证**：token 必须在服务端验证，客户端无法伪造
2. **IP 验证**：验证时包含用户 IP，防止 token 重用
3. **降级策略**：如果 Turnstile 服务不可用，仍然允许登录（适合私有系统）

### 验证流程

```typescript
// 1. 前端获取 token（自动）
Turnstile → 生成 token

// 2. 提交登录请求
POST /api/auth/login
{
  email: "...",
  password: "...",
  turnstileToken: "token-from-turnstile"
}

// 3. 服务端验证 token
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
{
  secret: "your-secret-key",
  response: "token-from-client",
  remoteip: "user-ip"
}

// 4. 验证通过，继续登录流程
```

---

## ⚙️ 配置选项

### Widget 模式

| 模式 | 说明 | 用户体验 |
|------|------|---------|
| **Invisible** | 完全隐藏，自动验证 | ⭐⭐⭐⭐⭐ 最佳 |
| **Managed** | Cloudflare 自动判断是否需要交互 | ⭐⭐⭐⭐ 良好 |
| **Non-Interactive** | 显示加载指示器 | ⭐⭐⭐ 一般 |

**推荐**：使用 **Invisible** 模式（当前实现）

### 主题设置

- `auto`: 自动适应系统主题（当前设置）
- `light`: 浅色主题
- `dark`: 深色主题

---

## 🐛 故障排除

### 问题：Turnstile 未加载

**可能原因**：
1. 环境变量未设置
2. Site Key 配置错误
3. 网络问题（无法访问 Cloudflare）

**解决方法**：
1. 检查环境变量是否正确设置
2. 检查浏览器控制台是否有错误
3. 确认网络可以访问 `challenges.cloudflare.com`

### 问题：验证总是失败

**可能原因**：
1. Secret Key 配置错误
2. Domain 配置不匹配
3. Token 已过期（有效期 5 分钟）

**解决方法**：
1. 检查 Secret Key 是否正确
2. 确认 Cloudflare Dashboard 中配置的域名匹配
3. 刷新页面重新获取 token

### 问题：登录被阻止

**可能原因**：
1. Turnstile 验证失败
2. Token 验证超时

**解决方法**：
1. 刷新页面重新验证
2. 检查服务器日志查看详细错误
3. 如果持续失败，可以暂时禁用 Turnstile（移除环境变量）

---

## 🔄 降级策略

如果 Turnstile 服务不可用或未配置，系统会自动降级：

- ✅ **未配置 Turnstile**：登录功能正常工作，跳过验证
- ✅ **Turnstile 加载失败**：允许登录，记录警告日志
- ✅ **验证服务不可用**：允许登录（适合私有系统）

这确保了即使 Turnstile 出现问题，管理员仍然可以登录。

---

## 📊 监控和日志

### 日志记录

登录 API 会记录 Turnstile 验证结果：

```json
{
  "type": "turnstile_verification",
  "success": true,
  "ip": "1.2.3.4",
  "timestamp": "2026-01-26T10:00:00Z"
}
```

### 监控建议

- 监控 Turnstile 验证失败率
- 监控异常验证模式（可能表示攻击）
- 记录验证响应时间

---

## 💡 最佳实践

1. **使用 Invisible 模式**：最佳用户体验
2. **配置正确的域名**：确保 Cloudflare Dashboard 中的域名匹配
3. **定期检查日志**：监控验证失败情况
4. **测试降级策略**：确保 Turnstile 不可用时系统仍可用

---

## 📚 参考资源

- [Cloudflare Turnstile 文档](https://developers.cloudflare.com/turnstile/)
- [Turnstile Widget 配置](https://developers.cloudflare.com/turnstile/concepts/widget/)
- [Turnstile 验证 API](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

---

**最后更新**: 2026-01-26
