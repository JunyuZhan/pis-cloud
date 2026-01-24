# 🚨 PIS 部署问题报告

**检查时间**: 2026-01-24  
**服务器**: 192.168.50.10

## 📊 检查结果摘要

### ✅ 正常服务
- **Worker**: ✅ 运行正常（已运行 34 小时）
- **Worker HTTP API**: ✅ 端口 3001 正常监听
- **环境变量文件**: ✅ 存在
- **Supabase 配置**: ✅ 已配置

### ❌ 问题服务
- **MinIO**: ❌ 未运行
- **Redis**: ❌ 未运行
- **MinIO Console**: ❌ 端口 9001 未监听
- **MinIO API**: ❌ 端口 9000 未监听
- **Redis**: ❌ 端口 6379 未监听

### ⚠️ 配置问题
- **MinIO Access Key**: ❌ 未在 .env 中配置
- **MinIO Secret Key**: ❌ 未在 .env 中配置
- **Docker Compose 文件**: ❌ 路径可能不正确
- **Worker Dockerfile**: ❌ 路径可能不正确

---

## 🔧 修复步骤

### 步骤 1: 检查文件结构

```bash
ssh root@192.168.50.10

# 检查目录结构
ls -la /opt/pis/
ls -la /opt/pis/docker/
```

**预期结构**:
```
/opt/pis/
├── .env
├── docker/
│   ├── docker-compose.yml
│   ├── worker.Dockerfile
│   └── nginx/
└── services/
    └── worker/
```

### 步骤 2: 修复环境变量

```bash
# 编辑环境变量文件
nano /opt/pis/.env

# 确保包含以下配置（如果缺失，添加）:
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos
```

### 步骤 3: 上传缺失的文件（如果需要）

如果 Docker Compose 文件不存在，需要上传：

```bash
# 从本地上传
scp docker/docker-compose.yml root@192.168.50.10:/opt/pis/docker/
scp docker/worker.Dockerfile root@192.168.50.10:/opt/pis/docker/
```

### 步骤 4: 启动服务

```bash
ssh root@192.168.50.10
cd /opt/pis/docker

# 启动所有服务
docker-compose up -d

# 或者分别启动
docker-compose up -d minio redis minio-init
docker-compose restart worker  # 重启 Worker 以应用新配置
```

### 步骤 5: 验证服务

```bash
# 检查服务状态
docker-compose ps

# 健康检查
curl http://localhost:9000/minio/health/live
docker exec pis-redis redis-cli ping
curl http://localhost:3001/health

# 查看日志
docker-compose logs -f
```

---

## 🐛 常见问题排查

### 问题 1: MinIO 无法启动

**可能原因**:
- 端口被占用
- 环境变量配置错误
- 数据卷权限问题

**解决方法**:
```bash
# 检查端口占用
netstat -tuln | grep 9000
ss -tuln | grep 9000

# 检查环境变量
docker-compose config

# 检查数据卷
docker volume ls | grep minio
```

### 问题 2: Redis 无法启动

**可能原因**:
- 端口被占用
- 数据卷权限问题

**解决方法**:
```bash
# 检查端口占用
netstat -tuln | grep 6379

# 检查 Redis 日志
docker-compose logs redis
```

### 问题 3: Worker 无法连接 MinIO/Redis

**可能原因**:
- 网络配置问题
- 环境变量错误
- 服务未启动

**解决方法**:
```bash
# 检查 Worker 环境变量
docker exec pis-worker env | grep -E "MINIO|REDIS"

# 测试网络连接
docker exec pis-worker ping -c 3 minio
docker exec pis-worker ping -c 3 redis

# 检查 Worker 日志
docker logs pis-worker
```

---

## 📋 完整修复命令（一键执行）

```bash
# 1. SSH 到服务器
ssh root@192.168.50.10

# 2. 进入项目目录
cd /opt/pis

# 3. 检查并修复环境变量
if ! grep -q "^MINIO_ACCESS_KEY=" .env; then
    echo "" >> .env
    echo "# MinIO 配置" >> .env
    echo "MINIO_ACCESS_KEY=minioadmin" >> .env
    echo "MINIO_SECRET_KEY=minioadmin" >> .env
fi

# 4. 进入 Docker 目录
cd docker

# 5. 启动服务
docker-compose up -d

# 6. 等待服务启动
sleep 10

# 7. 检查状态
docker-compose ps

# 8. 验证健康状态
curl http://localhost:9000/minio/health/live
docker exec pis-redis redis-cli ping
curl http://localhost:3001/health
```

---

## 🔍 详细检查命令

### 检查 Docker 服务
```bash
docker ps -a | grep pis
docker-compose ps
```

### 检查端口监听
```bash
netstat -tuln | grep -E "9000|9001|6379|3001"
# 或
ss -tuln | grep -E "9000|9001|6379|3001"
```

### 检查环境变量
```bash
cat /opt/pis/.env
docker exec pis-worker env | grep -E "SUPABASE|MINIO|REDIS"
```

### 检查日志
```bash
# 所有服务日志
docker-compose logs --tail 50

# 单个服务日志
docker-compose logs --tail 50 worker
docker-compose logs --tail 50 minio
docker-compose logs --tail 50 redis
```

### 检查网络
```bash
docker network ls
docker network inspect pis_default
```

---

## ✅ 修复后验证清单

- [ ] MinIO 服务运行正常
- [ ] Redis 服务运行正常
- [ ] Worker 服务运行正常
- [ ] 所有端口正常监听
- [ ] MinIO 健康检查返回 OK
- [ ] Redis ping 返回 PONG
- [ ] Worker HTTP API 健康检查正常
- [ ] MinIO Bucket 存在
- [ ] 环境变量配置完整

---

## 📞 需要帮助？

如果问题仍未解决，请提供以下信息：

1. **Docker Compose 日志**:
   ```bash
   docker-compose logs > /tmp/docker-logs.txt
   ```

2. **服务状态**:
   ```bash
   docker-compose ps > /tmp/service-status.txt
   ```

3. **环境变量**（隐藏敏感信息）:
   ```bash
   cat /opt/pis/.env | sed 's/=.*/=***/' > /tmp/env-check.txt
   ```

4. **系统信息**:
   ```bash
   docker --version
   docker-compose --version
   uname -a
   ```
