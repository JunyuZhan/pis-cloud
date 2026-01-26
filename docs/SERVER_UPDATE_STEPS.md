# 服务器端 Worker 更新步骤

> 更新时间: 2026-01-26  
> 项目目录: `/opt/PIS`

## 🚀 一键更新（推荐）

```bash
ssh root@192.168.50.10
cd /opt/PIS
bash scripts/update-worker-on-server.sh
```

---

## 📋 手动更新步骤

### 1. 拉取最新代码

```bash
ssh root@192.168.50.10
cd /opt/PIS
git pull origin main
```

### 2. 更新环境配置

**检查现有配置**:
```bash
# 检查是否有 .env.local
ls -la /opt/PIS/.env.local

# 如果没有，从 .env.example 创建
cp /opt/PIS/.env.example /opt/PIS/.env.local
```

**设置 WORKER_API_KEY**:
```bash
# 生成新的 API Key
openssl rand -hex 32

# 编辑环境变量文件
nano /opt/PIS/.env.local

# 添加或更新（使用你生成的 Key）:
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8
```

**或者使用本地已配置的值**（从本地 .env.local 复制）:
```bash
# 从本地复制 API Key（如果本地已配置）
# 本地 Key: 14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

nano /opt/PIS/.env.local
# 添加:
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8
```

### 3. 重新构建 Worker 镜像

```bash
cd /opt/PIS

# 构建新镜像
docker build -t pis-worker:latest -f docker/worker.Dockerfile .

# 或者如果使用 docker-worker 镜像名
docker build -t docker-worker:latest -f docker/worker.Dockerfile .
```

### 4. 重启 Worker 容器

```bash
# 停止并删除旧容器
docker stop pis-worker
docker rm pis-worker

# 启动新容器（根据你的实际配置调整）
docker run -d \
  --name pis-worker \
  --network host \
  --restart unless-stopped \
  -v /opt/PIS/.env.local:/app/.env.local:ro \
  pis-worker:latest

# 或者如果使用 docker-worker 镜像
docker run -d \
  --name pis-worker \
  --network host \
  --restart unless-stopped \
  -v /opt/PIS/.env.local:/app/.env.local:ro \
  docker-worker:latest
```

### 5. 验证更新

```bash
# 检查容器状态
docker ps | grep worker

# 检查日志（不应该看到 API Key 警告）
docker logs pis-worker --tail 30

# 应该看到:
# ✅ Worker listening on queue: photo-processing
# ✅ Package worker listening on queue: package-downloads
# 🌐 HTTP API listening on port 3001

# 测试 API（不带 Key，应该返回 401）
curl -X POST http://worker.albertzhan.top/api/process \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test","albumId":"test","originalKey":"test"}'

# 应该返回: {"error":"Unauthorized","message":"Invalid or missing API key"}

# 测试健康检查（不需要 Key）
curl http://worker.albertzhan.top/health
```

---

## 🔍 检查环境变量

**检查容器内的环境变量**:
```bash
# 方法1: 检查挂载的文件
docker exec pis-worker cat /app/.env.local | grep WORKER_API_KEY

# 方法2: 检查环境变量（如果通过 -e 传递）
docker exec pis-worker env | grep WORKER_API_KEY
```

**如果环境变量未加载**:
```bash
# 检查容器挂载
docker inspect pis-worker | grep -A 5 Mounts

# 确保 .env.local 文件存在
ls -la /opt/PIS/.env.local

# 确保容器有读取权限
docker exec pis-worker ls -la /app/.env.local
```

---

## ⚠️ 重要提醒

1. **API Key 必须一致**
   - Worker 容器和 Next.js 应用必须使用相同的 `WORKER_API_KEY`
   - 如果更新了 Worker 的 Key，也要更新 Next.js 的环境变量

2. **Next.js 环境变量**
   - 如果 Next.js 部署在 Vercel，需要在 Vercel Dashboard 中添加 `WORKER_API_KEY`
   - 如果 Next.js 也在同一服务器，确保 `.env.local` 中有相同的 Key

3. **重启顺序**
   - 先更新 Worker
   - 再更新 Next.js（如果需要）

---

## 🐛 故障排查

### 问题：构建失败

```bash
# 查看详细构建日志
docker build -f docker/worker.Dockerfile . --no-cache --progress=plain

# 检查 Dockerfile 路径
ls -la /opt/PIS/docker/worker.Dockerfile
```

### 问题：容器启动失败

```bash
# 查看容器日志
docker logs pis-worker

# 检查端口占用
netstat -tlnp | grep 3001

# 检查环境变量
docker exec pis-worker env | grep -E 'WORKER|SUPABASE|REDIS'
```

### 问题：API 仍然可以无认证访问

```bash
# 1. 检查环境变量是否正确加载
docker exec pis-worker cat /app/.env.local | grep WORKER_API_KEY

# 2. 检查 Worker 日志（应该没有警告）
docker logs pis-worker | grep "WORKER_API_KEY"

# 3. 重启容器
docker restart pis-worker
```

---

## 📝 完整命令序列

```bash
# SSH 到服务器
ssh root@192.168.50.10

# 1. 拉取代码
cd /opt/PIS
git pull origin main

# 2. 更新环境配置（如果还没有）
if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

# 生成并设置 API Key
API_KEY=$(openssl rand -hex 32)
echo "" >> .env.local
echo "WORKER_API_KEY=${API_KEY}" >> .env.local
echo "✅ API Key: ${API_KEY}"

# 3. 重新构建镜像
docker build -t pis-worker:latest -f docker/worker.Dockerfile .

# 4. 重启容器
docker stop pis-worker && docker rm pis-worker
docker run -d \
  --name pis-worker \
  --network host \
  --restart unless-stopped \
  -v /opt/PIS/.env.local:/app/.env.local:ro \
  pis-worker:latest

# 5. 验证
docker logs pis-worker --tail 20
curl http://worker.albertzhan.top/health
```

---

## ✅ 完成检查清单

- [ ] 代码已拉取（`git pull`）
- [ ] `.env.local` 文件已创建/更新
- [ ] `WORKER_API_KEY` 已设置（不是示例值）
- [ ] Worker 镜像已重新构建
- [ ] Worker 容器已重启
- [ ] 日志中没有 API Key 警告
- [ ] 未授权 API 调用返回 401
- [ ] 健康检查端点正常工作
- [ ] Next.js 环境变量已同步（如果不同服务器）
