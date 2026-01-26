# 如何获取 Cloudflare Turnstile 密钥

**最后更新**: 2026-01-26

---

## 📋 前置条件

- 一个 Cloudflare 账号（如果没有，免费注册：https://dash.cloudflare.com/sign-up）
- 你的网站域名（用于配置 Turnstile）

---

## 🚀 详细步骤

### 步骤 1: 登录 Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 使用你的账号登录（如果没有账号，点击 "Sign Up" 免费注册）

### 步骤 2: 进入 Turnstile 页面

**重要**：Turnstile 不在 Cloudflare One/Zero Trust（零信任）页面中！

1. **方法一：直接访问链接（推荐）**
   - 直接访问：https://dash.cloudflare.com/?to=/:account/turnstile
   - 这会直接跳转到 Turnstile 管理页面

2. **方法二：通过左侧导航栏（中文界面）**
   - 登录后，在左侧导航栏中找到 **"Turnstile"** 或 **"验证码"** 选项
   - 如果看不到，可能需要先添加一个网站到 Cloudflare
   - **注意**：Turnstile 在主页面的左侧菜单中，不在"零信任"或"Cloudflare One"页面中
   - **中文界面提示**：左侧菜单可能显示为"验证码"或"Turnstile"

3. **方法三：通过搜索（中文界面）**
   - 在 Cloudflare Dashboard 顶部搜索框输入 "Turnstile" 或 "验证码"
   - 点击搜索结果中的选项

**如果找不到 Turnstile**：
- 确保你已经登录 Cloudflare 账号
- 尝试直接访问：https://dash.cloudflare.com/?to=/:account/turnstile
- 如果还是找不到，可能需要先添加一个网站到 Cloudflare（即使不使用 Cloudflare 的 CDN 服务）

### 步骤 3: 创建新的 Turnstile 站点

1. 点击页面右上角的 **"添加站点"**、"Add Site"** 或 **"创建"**、"Create"** 按钮
   - **中文界面**：通常显示为"添加站点"或"创建"

2. 填写站点信息：

   **站点名称**（Site name）
   - 例如：`PIS Admin Login`
   - 这个名称仅用于管理，可以随意填写
   - **中文界面**：显示为"站点名称"

   **域名**（Domain）
   - 输入你的网站域名，例如：`yourdomain.com`
   - 支持通配符，例如：`*.yourdomain.com`
   - 对于本地开发，可以填写：`localhost` 或 `127.0.0.1`
   - **注意**：生产环境必须填写实际域名
   - **中文界面**：显示为"域名"

   **Widget 模式**（Widget Mode）
   - 选择 **"Invisible"**（推荐）或 **"不可见"**
     - 完全隐藏，用户无感知
     - 自动验证，无需用户操作
   - 或选择 **"Managed"** 或 **"托管"**
     - Cloudflare 自动判断是否需要交互
     - 大多数情况下也是无感知的
   - **中文界面**：可能显示为"不可见"、"托管"等

3. 点击 **"创建"** 或 **"Create"** 按钮创建站点
   - **中文界面**：显示为"创建"

### 步骤 4: 获取密钥

创建成功后，你会看到两个密钥：

#### 🔑 Site Key（站点密钥 - 公开密钥）

- **用途**：用于前端代码，会暴露在客户端
- **格式**：类似 `0x4AAAAAAABkMYinukE8q1E0R`
- **位置**：在站点详情页面的顶部或 "Site Key" / "站点密钥" 字段
- **复制方式**：点击密钥旁边的复制图标或直接选中复制
- **中文界面**：可能显示为"站点密钥"

#### 🔐 Secret Key（密钥 - 私密密钥）

- **用途**：用于服务端验证，**绝对不能**暴露在客户端
- **格式**：类似 `0x4AAAAAAABkMYinukE8q1E0R_xxxxxxxxxxxxxxxxxxxx`
- **位置**：在站点详情页面，可能需要点击 "Reveal"、"显示" 或 "Show" 才能看到
- **复制方式**：点击 "Reveal" 或 "显示" 按钮显示密钥，然后复制
- **中文界面**：可能显示为"密钥"或"私密密钥"，按钮显示为"显示"或"揭示"

### 步骤 5: 配置到项目中

将获取到的密钥添加到 `.env.local` 文件：

```bash
# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的Site Key
TURNSTILE_SECRET_KEY=你的Secret Key
```

**重要提示**：
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 必须以 `NEXT_PUBLIC_` 开头，因为需要在客户端使用
- `TURNSTILE_SECRET_KEY` 不需要 `NEXT_PUBLIC_` 前缀，只在服务端使用
- 不要将密钥提交到 Git 仓库（`.env.local` 应该在 `.gitignore` 中）

---

## 🖼️ 界面说明

### Turnstile 管理页面布局

```
┌─────────────────────────────────────────┐
│  Turnstile                              │
│  ┌───────────────────────────────────┐  │
│  │  Site name: PIS Admin Login      │  │
│  │  Domain: yourdomain.com           │  │
│  │  Widget Mode: Invisible          │  │
│  │                                   │  │
│  │  Site Key: 0x4AAAAAAABkMY...    │  │ ← 复制这个
│  │  [Reveal] Secret Key: ********   │  │ ← 点击 Reveal 后复制
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🔍 常见问题

### Q1: 找不到 Turnstile 选项？

**解决方法**：
1. 确保你已经登录 Cloudflare 账号
2. 尝试直接访问：https://dash.cloudflare.com/?to=/:account/turnstile
3. 如果还是没有，可能需要先添加一个网站到 Cloudflare

### Q2: 本地开发时域名应该填什么？

**解决方法**：
- 可以填写：`localhost`、`127.0.0.1`、`*.localhost`
- 或者填写你的实际域名（推荐，这样生产环境可以直接使用）

### Q3: 可以为一个域名创建多个 Turnstile 站点吗？

**可以**，但通常不需要。一个站点可以用于多个页面。

### Q4: Secret Key 忘记了怎么办？

**解决方法**：
1. 在 Turnstile 站点详情页面
2. 找到 "Secret Key" 字段
3. 点击 "Reveal" 或 "Show" 按钮显示密钥
4. 如果无法显示，可以删除站点重新创建（但会生成新的密钥）

### Q5: 密钥泄露了怎么办？

**解决方法**：
1. 在 Turnstile 站点详情页面
2. 找到 "Regenerate Secret Key" 选项
3. 重新生成新的 Secret Key
4. 更新 `.env.local` 文件中的密钥

### Q6: 免费账号有限制吗？

**没有限制**！Cloudflare Turnstile 对免费账号也提供：
- ✅ 无限请求
- ✅ 所有功能
- ✅ 无使用限制

---

## ✅ 验证密钥是否正确

### 方法 1: 检查前端加载

1. 启动开发服务器：`pnpm dev`
2. 访问登录页面：`http://localhost:3000/admin/login`
3. 打开浏览器开发者工具（F12）
4. 查看 Network 标签页
5. 应该能看到请求到 `challenges.cloudflare.com`
6. 如果没有错误，说明 Site Key 配置正确

### 方法 2: 检查后端验证

1. 尝试登录
2. 查看服务器控制台日志
3. 如果看到 Turnstile 验证日志，说明 Secret Key 配置正确
4. 如果看到验证失败的错误，检查 Secret Key 是否正确

---

## 📝 示例配置

### 完整的 `.env.local` 示例

```bash
# 其他配置...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare Turnstile (可选)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAABkMYinukE8q1E0R
TURNSTILE_SECRET_KEY=0x4AAAAAAABkMYinukE8q1E0R_xxxxxxxxxxxxxxxxxxxx
```

---

## 🔗 相关链接

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Turnstile 文档](https://developers.cloudflare.com/turnstile/)
- [Turnstile 配置指南](./TURNSTILE_SETUP.md)

---

**最后更新**: 2026-01-26
