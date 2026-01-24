# PIS 独立端口部署指南

## 📋 概述

本指南说明如何使用独立端口部署 PIS 系统的 MinIO 和 Redis，避免与其他应用冲突。

## 🔌 端口分配

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|---------|---------|------|
| MinIO API | 9000 | **19000** | 对象存储 API |
| MinIO Console | 9001 | **19001** | 管理控制台 |
| Redis | 6379 | **16379** | 任务队列 |
| Worker HTTP API | 3001 | **3001** | Worker 接口 |

## 🚀 快速部署

### 方法 1: 使用部署脚本（推荐）

```bash
# 从本地运行
./scripts/deploy-standalone.sh 192.168.50.10
```

### 方法 2: 手动部署

#### 步骤 1: 检查端口占用

```bash
ssh root@192.168.50.10

# 检查端口是否被占用
netstat -tuln | grep -E "19000|19001|16379|3001"
# 或
ss -tuln | grep -E "19000|19001|16379|3001"
```

#### 步骤 2: 上传配置文件

```bash
# 从本地上传 docker-compose.yml
scp docker/docker-compose.yml root@192.168.50.10:/opt/pis/docker/
```

#### 步骤 3: 配置环境变量

```bash
ssh root@192.168.50.10
cd /opt/pis

# 编辑环境变量文件
nano .env

# 确保包含以下配置:
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos

REDIS_HOST=redis
REDIS_PORT=6379
```

**重要**: 环境变量中的端口是 Docker **内部端口**（9000、6379），不需要修改。外部端口在 `docker-compose.yml` 中配置。

#### 步骤 4: 启动服务

```bash
cd /opt/pis/docker

# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 步骤 5: 验证服务

```bash
# 健康检查
curl http://localhost:19000/minio/health/live
# 预期: OK

docker exec pis-redis redis-cli ping
# 预期: PONG

curl http://localhost:3001/health
# 预期: {"status":"ok"}

# 检查端口监听
netstat -tuln | grep -E "19000|19001|16379|3001"
```

## 🌐 Nginx 配置

### 更新 Nginx 反向代理

如果之前配置了 Nginx，需要更新端口：

```nginx
# 修改前
upstream minio_s3 {
    server 127.0.0.1:9000;  # ❌ 旧端口
}

# 修改后
upstream minio_s3 {
    server 127.0.0.1:19000;  # ✅ 新端口
}
```

### 完整 Nginx 配置示例

```nginx
# MinIO API 反向代理
upstream pis_minio {
    server 127.0.0.1:19000;  # 使用新端口
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    # SSL 配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 允许大文件上传
    client_max_body_size 100M;

    location / {
        proxy_pass http://pis_minio;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 缓存控制
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";

        # CORS
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    }
}
```

## 🔍 故障排查

### 问题 1: 端口冲突

如果 19000、19001、16379 也被占用，可以修改 `docker-compose.yml`：

```yaml
ports:
  - "127.0.0.1:29000:9000"  # 改为其他端口
  - "127.0.0.1:29001:9001"
  - "127.0.0.1:26379:6379"
```

### 问题 2: Worker 无法连接 MinIO/Redis

检查 Docker 网络：

```bash
# 检查网络
docker network ls | grep pis
docker network inspect pis-network

# 测试连接
docker exec pis-worker ping -c 3 minio
docker exec pis-worker ping -c 3 redis

# 检查环境变量
docker exec pis-worker env | grep -E "MINIO|REDIS"
```

### 问题 3: MinIO Bucket 未初始化

```bash
# 手动初始化 Bucket
docker exec pis-minio-init mc ls local/pis-photos

# 如果失败，手动执行
docker exec -it pis-minio mc alias set pis http://minio:9000 minioadmin minioadmin
docker exec -it pis-minio mc mb pis/pis-photos
docker exec -it pis-minio mc anonymous set download pis/pis-photos/processed
```

## 📊 服务管理

### 查看服务状态

```bash
cd /opt/pis/docker
docker-compose ps
```

### 查看日志

```bash
# 所有服务日志
docker-compose logs -f

# 单个服务日志
docker-compose logs -f worker
docker-compose logs -f minio
docker-compose logs -f redis
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart worker
docker-compose restart minio
```

### 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（谨慎！）
docker-compose down -v
```

## 🔒 安全建议

1. **端口绑定**: 所有端口只绑定到 `127.0.0.1`，不暴露到公网
2. **MinIO 密码**: 修改默认密码
3. **防火墙**: 配置防火墙规则，只允许必要的访问
4. **Redis 密码**: 如果需要外部访问 Redis，建议设置密码

## 📝 环境变量说明

### Worker 环境变量（.env）

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# MinIO (Docker 内部)
MINIO_ENDPOINT_HOST=minio      # 服务名，不要改
MINIO_ENDPOINT_PORT=9000       # 内部端口，不要改
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos

# Redis (Docker 内部)
REDIS_HOST=redis               # 服务名，不要改
REDIS_PORT=6379               # 内部端口，不要改
```

**重要**: 
- `MINIO_ENDPOINT_HOST` 和 `REDIS_HOST` 使用 Docker 服务名（minio、redis）
- `MINIO_ENDPOINT_PORT` 和 `REDIS_PORT` 使用 Docker 内部端口（9000、6379）
- 外部端口在 `docker-compose.yml` 中配置（19000、16379）

## ✅ 部署检查清单

- [ ] 端口 19000、19001、16379、3001 未被占用
- [ ] docker-compose.yml 已上传到服务器
- [ ] 环境变量文件已配置
- [ ] 所有服务启动成功
- [ ] MinIO 健康检查通过
- [ ] Redis 连接正常
- [ ] Worker API 正常
- [ ] MinIO Bucket 已创建
- [ ] Nginx 配置已更新（如果使用）

## 🎯 下一步

部署完成后：

1. **更新前端配置**: 确保 `NEXT_PUBLIC_MEDIA_URL` 指向正确的 Nginx 地址
2. **测试上传**: 在管理后台测试照片上传功能
3. **监控日志**: 观察 Worker 日志，确保图片处理正常
4. **性能优化**: 根据实际情况调整 Worker 并发数

---

**需要帮助？** 查看 [故障排除文档](./DEPLOYMENT.md#故障排除)
