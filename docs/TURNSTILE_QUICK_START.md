# Cloudflare Turnstile 快速开始

**最后更新**: 2026-01-26

---

## 🎯 快速获取密钥（3 步）

### 步骤 1: 直接访问 Turnstile 页面

**重要**：Turnstile 不在 Cloudflare One/Zero Trust（零信任）页面中！

直接访问这个链接：
👉 **https://dash.cloudflare.com/?to=/:account/turnstile**

或者：
1. 访问 https://dash.cloudflare.com/
2. 登录你的账号
3. 在左侧导航栏找到 **"Turnstile"** 或 **"验证码"**（不在零信任中）
   - **中文界面**：可能显示为"验证码"或"Turnstile"

### 步骤 2: 创建站点

1. 点击 **"添加站点"**、"Add Site"** 或 **"创建"**、"Create"**
   - **中文界面**：显示为"添加站点"或"创建"
2. 填写：
   - **站点名称**（Site name）: `PIS Admin Login`（任意名称）
   - **域名**（Domain）: `yourdomain.com` 或 `localhost`（本地开发）
   - **Widget 模式**（Widget Mode）: 选择 **"Invisible"** 或 **"不可见"**
3. 点击 **"创建"** 或 **"Create"**

### 步骤 3: 复制密钥

创建成功后，你会看到两个密钥：

- **Site Key**（站点密钥）：直接复制（用于前端）
  - **中文界面**：显示为"站点密钥"
- **Secret Key**（密钥）：点击 "Reveal" 或 "显示" 后复制（用于后端）
  - **中文界面**：显示为"密钥"，按钮显示为"显示"或"揭示"

---

## ⚙️ 配置到项目

将密钥添加到 `.env.local`：

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的Site Key
TURNSTILE_SECRET_KEY=你的Secret Key
```

然后重启开发服务器：`pnpm dev`

---

## ❓ 常见问题

### Q: 找不到 Turnstile？

**解决方法**：
- 直接访问：https://dash.cloudflare.com/?to=/:account/turnstile
- Turnstile 不在零信任/Cloudflare One 页面中
- **中文界面**：在左侧菜单中查找"验证码"或"Turnstile"
- 如果还是找不到，可能需要先添加一个网站到 Cloudflare

### Q: 本地开发域名填什么？

可以填：`localhost`、`127.0.0.1` 或你的实际域名

### Q: 免费吗？

**完全免费**！无任何限制。

---

## 📚 详细文档

- [如何获取密钥](./TURNSTILE_GET_KEYS.md) - 详细步骤
- [配置指南](./TURNSTILE_SETUP.md) - 完整配置说明

---

**最后更新**: 2026-01-26
