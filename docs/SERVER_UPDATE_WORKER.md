# 服务器端 Worker 更新指南

> 更新时间: 2026-01-26

## 🚀 快速更新（推荐）

在服务器上运行一键更新脚本：

```bash
ssh root@192.168.50.10
cd /root/PIS
bash scripts/update-worker-on-server.sh
```

脚本会自动：
1. ✅ 拉取最新代码
2. ✅ 检查并生成 API Key（如果需要）
3. ✅ 重新构建 Worker 镜像
4. ✅ 重启 Worker 服务

---

## 📋 手动更新步骤

如果脚本无法使用，可以手动执行：

### 1. 拉取最新代码

```bash
ssh root@192.168.50.10
cd /root/PIS
git pull origin main
```

### 2. 更新环境配置

```bash
# 检查 .env.local 文件
cat /root/PIS/.env.local | grep WORKER_API_KEY

# 如果没有设置或使用示例值，生成新的 Key
openssl rand -hex 32

# 编辑环境变量文件
nano /root/PIS/.env.local

# 添加或更新:
WORKER_API_KEY=你生成的密钥
```

### 3. 重新构建 Worker 镜像

**方法1: 使用 Docker Compose**
```bash
cd /root/PIS
docker-compose build worker
docker-compose restart worker
```

**方法2: 使用 Dockerfile**
```bash
cd /root/PIS
docker build -t pis-worker:latest -f docker/worker.Dockerfile .
docker restart pis-worker
```

### 4. 验证更新

```bash
# 检查 Worker 日志
docker logs pis-worker --tail 30

# 应该看到:
# ✅ Worker listening on queue: photo-processing
# ✅ Package worker listening on queue: package-downloads
# 🌐 HTTP API listening on port 3001
# 不应该看到: ⚠️ WORKER_API_KEY not set

# 测试 API（应该返回 401）
curl -X POST http://worker.albertzhan.top/api/process \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'

# 测试健康检查（应该正常）
curl http://worker.albertzhan.top/health
```

---

## 🔧 环境配置文件位置

服务器上可能有两个地方有环境配置：

1. **项目根目录**: `/root/PIS/.env.local`
   - 用于 Docker Compose
   - 会被挂载到容器中

2. **Docker 容器环境变量**
   - 如果使用 `docker run` 启动
   - 需要检查容器的环境变量

**检查方法**:
```bash
# 检查容器环境变量
docker exec pis-worker env | grep WORKER_API_KEY

# 检查挂载的文件
docker exec pis-worker cat /app/.env.local | grep WORKER_API_KEY
```

---

## ⚠️ 重要提醒

1. **API Key 必须一致**
   - Worker 和 Next.js 必须使用相同的 `WORKER_API_KEY`
   - 如果更新了 Worker 的 Key，也要更新 Next.js 的环境变量

2. **Next.js 环境变量**
   - 如果 Next.js 部署在 Vercel 或其他平台
   - 需要在平台的环境变量设置中添加 `WORKER_API_KEY`

3. **重启顺序**
   - 先更新 Worker
   - 再更新 Next.js（如果需要）

---

## 🐛 故障排查

### 问题：Worker 启动失败

**检查日志**:
```bash
docker logs pis-worker --tail 50
```

**常见原因**:
- 环境变量未正确加载
- 端口被占用
- Redis 连接失败

### 问题：API 返回 401

**检查**:
```bash
# 1. 检查环境变量
docker exec pis-worker env | grep WORKER_API_KEY

# 2. 检查 Next.js 环境变量（如果部署在 Vercel）
# 在 Vercel Dashboard -> Settings -> Environment Variables 中检查

# 3. 确保两个服务使用相同的 Key
```

### 问题：构建失败

**检查**:
```bash
# 查看构建日志
docker-compose build worker --no-cache

# 或
docker build -f docker/worker.Dockerfile . --no-cache
```

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 Worker 日志: `docker logs pis-worker --tail 50`
2. 检查环境变量: `docker exec pis-worker env | grep WORKER`
3. 检查代码版本: `cd /root/PIS && git log --oneline -5`
