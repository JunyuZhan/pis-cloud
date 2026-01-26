# Worker 安全修复说明

> 修复时间: 2026-01-26  
> 修复原因: Worker 服务暴露到公网时，存在安全风险

## 🔒 修复内容

### 1. **添加 API Key 认证** ✅
- Worker API 现在需要 `X-API-Key` 或 `Authorization: Bearer <key>` 头
- 健康检查端点 `/health` 不需要认证（用于监控）

### 2. **添加请求大小限制** ✅
- JSON 请求：最大 10MB
- 文件上传：最大 500MB
- 分片上传：单个分片最大 100MB

### 3. **改进 CORS 配置** ✅
- 支持通过 `CORS_ORIGINS` 环境变量配置允许的来源
- 开发环境默认允许所有来源

### 4. **完善错误处理** ✅
- JSON 解析错误现在返回 400 而不是 500
- 请求过大返回 413
- 未授权返回 401

### 5. **完善优雅退出** ✅
- 正确处理 SIGTERM 和 SIGINT
- 关闭所有 worker、队列和连接
- 清理定时器

### 6. **添加未捕获异常处理** ✅
- 处理 `uncaughtException` 和 `unhandledRejection`
- 记录错误并优雅退出

---

## 📝 配置步骤

### 1. 设置环境变量

在 `.env.local` 或生产环境变量中添加：

```bash
# Worker API Key (必须配置，生产环境使用强密码)
WORKER_API_KEY=your-secret-api-key-change-this-in-production

# CORS 配置（可选，多个域名用逗号分隔）
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

### 2. 生成安全的 API Key

**方法1: 使用快速设置脚本（推荐）**
```bash
# 在生产服务器上运行
ssh user@your-server-ip
cd /path/to/PIS
bash scripts/setup-worker-api-key.sh
```

**方法2: 手动生成**
```bash
# 使用 openssl
openssl rand -hex 32

# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 使用在线密码生成器（至少 32 字符）
```

**重要**: 
- ❌ **不要使用示例值** `your-secret-api-key-change-this-in-production`
- ✅ **必须生成自己的唯一密钥**（至少 32 字符）
- ✅ 不同环境（开发/生产）可以使用不同的 Key

### 3. 更新生产环境配置

**重要**: 必须在生产服务器上设置 `WORKER_API_KEY` 环境变量！

```bash
# SSH 到服务器
ssh user@your-server-ip

# 编辑环境变量文件（根据你的部署方式）
# 如果使用 Docker Compose:
nano /path/to/PIS/.env.local

# 添加或更新:
WORKER_API_KEY=your-generated-secret-key

# 重启 Worker 服务
docker-compose restart worker
# 或
docker restart pis-worker
```

---

## 🔧 代码变更

### Worker 端 (`services/worker/src/index.ts`)

1. **新增认证函数**:
```typescript
function authenticateRequest(req: http.IncomingMessage): boolean {
  const apiKey = req.headers['x-api-key'] || 
                 req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  return apiKey === WORKER_API_KEY;
}
```

2. **新增请求大小限制**:
```typescript
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB
```

3. **所有 API 端点添加认证检查**（除了 `/health`）

### Next.js 端

所有调用 Worker API 的地方都添加了 API Key：

- `apps/web/src/app/api/worker/[...path]/route.ts`
- `apps/web/src/app/api/admin/upload-proxy/route.ts`
- `apps/web/src/app/api/admin/photos/process/route.ts`
- `apps/web/src/app/api/admin/photos/[id]/cleanup/route.ts`
- `apps/web/src/app/api/admin/photos/[id]/rotate/route.ts`
- `apps/web/src/app/api/admin/albums/[id]/scan/route.ts`
- `apps/web/src/app/api/admin/albums/[id]/package/route.ts`

---

## ✅ 验证修复

### 1. 测试认证

```bash
# 测试未授权访问（应该返回 401）
curl -X POST http://your-worker-domain.com/api/process \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'

# 应该返回: {"error":"Unauthorized","message":"Invalid or missing API key"}

# 测试带认证的访问（应该成功）
curl -X POST http://your-worker-domain.com/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'
```

### 2. 测试请求大小限制

```bash
# 测试超大 JSON（应该返回 413）
curl -X POST http://your-worker-domain.com/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d "$(python3 -c "print('x' * 11 * 1024 * 1024)")"
```

### 3. 测试健康检查（不需要认证）

```bash
# 应该返回健康状态
curl http://your-worker-domain.com/health
```

---

## 🚨 重要提醒

1. **必须设置 WORKER_API_KEY**
   - 开发环境：可以不设置（会有警告）
   - 生产环境：**必须设置强密码**

2. **API Key 安全**
   - 不要提交到 Git
   - 不要在前端代码中使用
   - 定期轮换（建议每 3-6 个月）

3. **向后兼容**
   - 如果没有设置 `WORKER_API_KEY`，API 仍然可以访问（但有警告）
   - 这是为了开发环境的便利性
   - **生产环境必须设置**

---

## 📋 检查清单

部署前确认：

- [ ] 已生成安全的 API Key（至少 32 字符）
- [ ] 已在 `.env.local` 或生产环境变量中设置 `WORKER_API_KEY`
- [ ] 已重启 Worker 服务
- [ ] 已测试 API 认证（未授权访问返回 401）
- [ ] 已测试正常功能（带认证的请求正常工作）
- [ ] 已测试健康检查端点（不需要认证）

---

## 🔗 相关文件

- `services/worker/src/index.ts` - Worker 主文件（已修复）
- `.env.example` - 环境变量示例（已更新）
- `apps/web/src/app/api/worker/[...path]/route.ts` - Worker 代理（已更新）
- `apps/web/src/app/api/admin/**/*.ts` - 所有调用 Worker 的 API（已更新）

---

## 📞 问题排查

### 问题：API 返回 401 Unauthorized

**原因**: API Key 未设置或错误

**解决**:
1. 检查环境变量 `WORKER_API_KEY` 是否设置
2. 检查 Next.js 和 Worker 的 API Key 是否一致
3. 检查请求头是否正确：`X-API-Key` 或 `Authorization: Bearer <key>`

### 问题：请求返回 413 Request Entity Too Large

**原因**: 请求体超过限制

**解决**:
- JSON 请求：最大 10MB
- 文件上传：使用分片上传（自动处理）

### 问题：Worker 启动时警告 API Key 未设置

**原因**: 开发环境未设置 `WORKER_API_KEY`

**解决**:
- 开发环境：可以忽略（但建议设置）
- 生产环境：**必须设置**

---

## 🎉 完成

所有安全修复已完成！Worker 服务现在：
- ✅ 有 API Key 认证保护
- ✅ 有请求大小限制
- ✅ 有完善的错误处理
- ✅ 有优雅退出机制
