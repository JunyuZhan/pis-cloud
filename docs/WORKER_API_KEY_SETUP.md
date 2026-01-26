# Worker API Key 快速设置指南

> 更新时间: 2026-01-26

## 🚀 快速开始

### 1. 生成 API Key

在终端运行以下命令之一：

```bash
# 方法1: 使用 openssl（推荐）
openssl rand -hex 32

# 方法2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**示例输出**:
```
fcf95e5318090de961bbb099203778c982526d12bb72979d3c43c216cbc0ef5c
```

### 2. 设置到本地开发环境

编辑 `.env.local` 文件（如果不存在，从 `.env.example` 复制）：

```bash
# 在项目根目录
cp .env.example .env.local
nano .env.local
```

添加或更新：
```bash
WORKER_API_KEY=fcf95e5318090de961bbb099203778c982526d12bb72979d3c43c216cbc0ef5c
```

### 3. 设置到生产服务器

**SSH 到服务器**:
```bash
ssh user@your-server-ip
```

**编辑环境变量文件**:
```bash
# 找到 Worker 的环境变量文件（根据你的部署方式）
# 如果使用 Docker Compose:
nano /path/to/PIS/.env.local

# 如果使用 Docker 环境变量:
# 需要修改 docker-compose.yml 或 Dockerfile
```

**添加或更新**:
```bash
WORKER_API_KEY=fcf95e5318090de961bbb099203778c982526d12bb72979d3c43c216cbc0ef5c
```

**重启 Worker 服务**:
```bash
# 如果使用 Docker Compose:
cd /path/to/PIS
docker-compose restart worker

# 如果使用单独的 Docker 容器:
docker restart pis-worker

# 验证 Worker 是否正常启动
docker logs pis-worker --tail 20
```

---

## ✅ 验证设置

### 1. 检查 Worker 日志

```bash
docker logs pis-worker --tail 20
```

**应该看到**:
- ✅ `🚀 PIS Worker Starting...`
- ✅ `✅ Worker listening on queue: photo-processing`
- ✅ `🌐 HTTP API listening on port 3001`

**不应该看到**:
- ❌ `⚠️ WORKER_API_KEY not set, API endpoints are unprotected!`

### 2. 测试 API 认证

```bash
# 测试未授权访问（应该返回 401）
curl -X POST http://your-worker-domain.com/api/process \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'

# 应该返回: {"error":"Unauthorized","message":"Invalid or missing API key"}

# 测试带认证的访问（使用你的 API Key）
curl -X POST http://your-worker-domain.com/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-generated-api-key" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'

# 应该返回: {"success":true,"message":"Job queued"}
```

### 3. 测试健康检查（不需要认证）

```bash
curl http://your-worker-domain.com/health

# 应该返回: {"status":"ok","timestamp":"...","services":{...}}
```

---

## 🔐 安全最佳实践

### ✅ 应该做的

1. **使用强密码**
   - 至少 32 字符
   - 使用随机生成器
   - 包含字母和数字

2. **不同环境使用不同 Key**
   - 开发环境：一个 Key
   - 生产环境：另一个 Key
   - 测试环境：第三个 Key

3. **定期轮换**
   - 建议每 3-6 个月更换一次
   - 更换时先设置新 Key，再删除旧 Key

4. **安全存储**
   - 使用环境变量，不要硬编码
   - 不要提交到 Git
   - 使用密钥管理工具（如 1Password、Vault）

### ❌ 不应该做的

1. **不要使用弱密码**
   - ❌ `123456`
   - ❌ `password`
   - ❌ `admin`
   - ❌ `test123`

2. **不要使用示例值**
   - ❌ `your-secret-api-key-change-this-in-production`
   - ❌ `change-this-in-production`

3. **不要提交到 Git**
   - ❌ 不要提交 `.env.local`
   - ❌ 不要在代码中硬编码

4. **不要在前端使用**
   - ❌ 不要在前端代码中暴露 API Key
   - ✅ 只在服务端（Next.js API）使用

---

## 📋 检查清单

部署前确认：

- [ ] 已生成安全的 API Key（至少 32 字符）
- [ ] 已在本地 `.env.local` 中设置
- [ ] 已在生产服务器环境变量中设置
- [ ] 已重启 Worker 服务
- [ ] 已测试未授权访问返回 401
- [ ] 已测试带认证的请求正常工作
- [ ] 已测试健康检查端点（不需要认证）
- [ ] 已确认 `.env.local` 在 `.gitignore` 中

---

## 🔧 故障排查

### 问题：Worker 启动时显示警告

```
⚠️  WORKER_API_KEY not set, API endpoints are unprotected!
```

**原因**: 环境变量未设置

**解决**:
1. 检查 `.env.local` 文件是否存在
2. 检查 `WORKER_API_KEY` 是否已设置
3. 检查 Docker 容器是否读取了环境变量
4. 重启 Worker 服务

### 问题：API 返回 401 Unauthorized

**原因**: API Key 不匹配

**解决**:
1. 检查 Next.js 和 Worker 的 `WORKER_API_KEY` 是否一致
2. 检查请求头是否正确：`X-API-Key: <your-key>`
3. 检查环境变量是否正确加载

### 问题：本地开发正常，生产环境 401

**原因**: 生产环境未设置 API Key

**解决**:
1. SSH 到生产服务器
2. 检查环境变量文件
3. 确认 Docker 容器读取了环境变量
4. 重启 Worker 服务

---

## 📞 需要帮助？

如果遇到问题，检查：

1. **Worker 日志**:
   ```bash
   docker logs pis-worker --tail 50
   ```

2. **环境变量**:
   ```bash
   docker exec pis-worker env | grep WORKER_API_KEY
   ```

3. **Next.js 环境变量**:
   ```bash
   # 在 Next.js 部署平台检查环境变量设置
   ```

---

## 🎉 完成

设置完成后，Worker API 现在受到保护：
- ✅ 未授权访问会被拒绝（401）
- ✅ 只有带正确 API Key 的请求才能访问
- ✅ 健康检查端点仍然公开（用于监控）
