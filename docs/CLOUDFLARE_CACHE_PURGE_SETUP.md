# Cloudflare 缓存清除配置指南

## 📋 配置步骤

### 步骤 1：获取 Cloudflare API Token

1. **登录 Cloudflare 控制台**
   - 访问：https://dash.cloudflare.com/
   - 使用你的账号登录

2. **创建 API 令牌**
   - 点击右上角头像 → **我的个人资料**（或 **My Profile**）
   - 左侧菜单选择 **API 令牌**（或 **API Tokens**）
   - 点击 **创建令牌**（或 **Create Token**）

3. **配置令牌权限**
   - 在 **权限** 部分，点击 **添加更多** 添加权限：
     - **区域** → **清除缓存** → **清除**
   - 在 **区域资源** 部分：
     - 选择 **包括** → **特定区域**
     - 点击 **Select...** 下拉框
     - 选择你的域名（`albertzhan.top`）
   - **客户端 IP 地址筛选**：可以留空（默认适用于所有地址）
   - **TTL**：可以留空（默认永久有效）

4. **创建并复制令牌**
   - 配置完成后，滚动到页面底部
   - 点击 **创建令牌** 按钮
   - **重要**：立即复制显示的令牌（只显示一次，关闭后无法再次查看）
   - 格式类似：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 建议保存到安全的地方（如密码管理器）

### 步骤 2：获取区域 ID（Zone ID）

1. **进入域名管理**
   - 在 Cloudflare 控制台首页
   - 点击你的域名（`albertzhan.top`）

2. **找到区域 ID**
   - 在右侧边栏（概览页面，或 **Overview**）
   - 找到 **区域 ID**（或 **Zone ID**，一串字母数字）
   - 点击复制
   - 格式类似：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 步骤 3：配置环境变量

#### 在 Vercel 中配置

1. **进入 Vercel 控制台**
   - 访问：https://vercel.com/dashboard
   - 选择你的项目

2. **添加环境变量**
   - 进入 **设置**（或 **Settings**）→ **环境变量**（或 **Environment Variables**）
   - 添加以下变量：

   ```
   变量名: CLOUDFLARE_API_TOKEN
   值: 你的 API 令牌（步骤 1 获取的）
   环境: Production（生产环境）、Preview（预览环境）、Development（开发环境）（全选）
   ```

   ```
   变量名: CLOUDFLARE_ZONE_ID
   值: 你的区域 ID（步骤 2 获取的）
   环境: Production（生产环境）、Preview（预览环境）、Development（开发环境）（全选）
   ```

3. **保存并重新部署**
   - 点击 **保存**（或 **Save**）
   - 重新部署应用（或等待下次部署）

#### 在 Worker 服务中配置

如果你的 Worker 服务是独立部署的（不在 Vercel），需要在 Worker 服务的环境变量中配置：

```bash
# Worker 服务环境变量
CLOUDFLARE_API_TOKEN=你的 API Token
CLOUDFLARE_ZONE_ID=你的 Zone ID
```

**配置方式取决于你的部署方式**：
- **Docker**: 在 `docker-compose.yml` 或启动命令中添加环境变量
- **PM2**: 在 `ecosystem.config.js` 中配置
- **systemd**: 在服务配置文件中添加环境变量
- **GitHub Actions**: 在 GitHub 仓库的 Secrets 中配置（见下方说明）
- **其他**: 根据你的部署方式配置

#### 在 GitHub Actions 中配置（如果使用 CI/CD）

**重要说明**：Cloudflare API Token 和 Zone ID 是**运行时环境变量**，需要在**目标服务器**上配置，而不是在 GitHub Actions Secrets 中。

**配置方式**：

1. **如果 Worker 服务部署在服务器上**：
   - 在服务器的环境变量中配置（如 `.env.local`、`docker-compose.yml` 等）
   - GitHub Actions 只负责部署代码，不负责配置运行时环境变量

2. **如果需要在部署时设置环境变量**：
   - 可以在部署脚本中添加环境变量设置
   - 或在 `docker-compose.yml` 中配置环境变量

**示例（docker-compose.yml）**：
```yaml
services:
  worker:
    environment:
      # ... 其他环境变量 ...
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-}
      - CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID:-}
```

然后在服务器上的 `.env.local` 文件中添加：
```bash
CLOUDFLARE_API_TOKEN=你的 API 令牌
CLOUDFLARE_ZONE_ID=你的区域 ID
```

**注意**：
- ⚠️ 不要在 GitHub Actions 工作流文件中硬编码这些敏感信息
- ✅ 在服务器上通过环境变量文件或配置管理工具配置
- ✅ 确保 `.env.local` 文件在 `.gitignore` 中（已默认忽略）

### 步骤 4：验证配置

1. **删除一张测试照片**
   - 在管理后台删除一张照片
   - 查看服务器日志（Vercel Functions Logs）

2. **检查日志**
   - 应该看到类似日志：
     ```
     [Cloudflare Purge] Successfully purged 3 URLs
     ```
   - 如果看到：
     ```
     [Cloudflare Purge] Zone ID or API Token not configured, skipping cache purge
     ```
     说明配置未生效，检查环境变量是否正确

3. **测试旧 URL**
   - 尝试访问已删除照片的旧 URL
   - 应该返回 404 或无法访问

## 🔍 故障排查

### 问题 1：日志显示 "not configured"

**原因**：环境变量未正确配置

**解决**：
1. 检查 Vercel 环境变量是否正确添加
2. 确认变量名完全一致（区分大小写）
3. 重新部署应用

### 问题 2：API 调用失败

**原因**：令牌权限不足或区域 ID 错误

**解决**：
1. 检查令牌权限是否包含 "清除缓存"（Cache Purge）
2. 确认区域 ID（Zone ID）是否正确
3. 确认令牌对应的区域是否匹配

### 问题 3：清除缓存失败

**原因**：API 速率限制或网络问题

**解决**：
1. Cloudflare 免费版每天可清除 1000 个 URL
2. 如果超过限制，需要等待或升级计划
3. 检查网络连接是否正常

## 📊 配置检查清单

- [ ] Cloudflare API 令牌已创建
- [ ] 令牌权限包含 "清除缓存"（Cache Purge）
- [ ] 区域 ID（Zone ID）已获取
- [ ] Vercel 环境变量已配置
- [ ] Worker 服务环境变量已配置（如果独立部署）
- [ ] GitHub Actions Secrets 已配置（如果使用 GitHub Actions）
- [ ] 应用已重新部署
- [ ] 测试删除照片，日志显示清除成功

## 💡 注意事项

1. **令牌安全**
   - ⚠️ **重要**：API 令牌是敏感信息，**绝对不要**提交到代码仓库（如 GitHub）
   - ✅ 只在环境变量中配置（Vercel、Worker 服务等）
   - ✅ 确保 `.env.local` 文件在 `.gitignore` 中（已默认忽略）
   - ✅ 如果泄露，立即在 Cloudflare 控制台中删除并重新创建
   - ❌ **不要**在代码中硬编码 Token
   - ❌ **不要**提交包含 Token 的配置文件到 GitHub

2. **速率限制**
   - Cloudflare 免费版：每天 1000 个 URL
   - 如果批量删除大量照片，可能触发限制
   - 系统会自动分批处理，避免触发限制

3. **成本**
   - Cloudflare 免费版完全免费
   - 缓存清除不产生额外费用

## 🎯 配置完成后

配置完成后，删除照片时会自动：
1. ✅ 清除 Cloudflare CDN 缓存
2. ✅ 更新 `updated_at`（备用方案）
3. ✅ 确保删除后无法通过 CDN 访问
