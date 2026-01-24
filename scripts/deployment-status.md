# PIS 部署状态检查清单

## 快速检查命令

### 1. SSH 连接到服务器并检查 Docker 服务

```bash
ssh root@192.168.50.10

# 检查 Docker 服务状态
cd /opt/pis/docker
docker-compose ps

# 预期输出:
# NAME            STATUS
# pis-minio       Up (healthy)
# pis-redis       Up (healthy)
# pis-worker      Up
```

### 2. 检查服务健康状态

```bash
# MinIO 健康检查
curl http://localhost:9000/minio/health/live
# 预期: OK

# Redis 连接测试
docker exec pis-redis redis-cli ping
# 预期: PONG

# Worker HTTP API 健康检查
curl http://localhost:3001/health
# 预期: {"status":"ok"}
```

### 3. 检查 Worker 日志

```bash
# 查看 Worker 实时日志
docker-compose logs -f worker

# 查看最近100行日志
docker-compose logs --tail 100 worker
```

### 4. 检查 MinIO Bucket

```bash
# 列出 Bucket 中的文件
docker exec pis-minio mc ls local/pis-photos

# 检查 Bucket 权限
docker exec pis-minio mc anonymous get local/pis-photos/processed
```

### 5. 检查环境变量配置

```bash
# 查看环境变量文件
cat /opt/pis/.env

# 检查 Worker 环境变量
docker exec pis-worker env | grep -E "SUPABASE|MINIO|REDIS"
```

### 6. 检查端口监听

```bash
# 检查端口是否监听
netstat -tuln | grep -E "9000|9001|6379|3001"
# 或
ss -tuln | grep -E "9000|9001|6379|3001"
```

## 常见问题排查

### Worker 无法启动

1. **检查环境变量**
   ```bash
   docker exec pis-worker env | grep SUPABASE
   ```

2. **检查日志**
   ```bash
   docker-compose logs worker
   ```

3. **检查 Redis 连接**
   ```bash
   docker exec pis-worker ping -c 3 redis
   ```

4. **检查 MinIO 连接**
   ```bash
   docker exec pis-worker ping -c 3 minio
   ```

### 图片无法上传

1. **检查 MinIO 服务**
   ```bash
   docker-compose ps pis-minio
   curl http://localhost:9000/minio/health/live
   ```

2. **检查 Worker 是否处理任务**
   ```bash
   docker-compose logs worker | grep "Processing photo"
   ```

3. **检查 Redis 队列**
   ```bash
   docker exec pis-redis redis-cli LLEN bull:photo-processing
   ```

### 图片无法显示

1. **检查 Nginx 配置**
   ```bash
   # 查看 Nginx 错误日志
   tail -f /www/wwwlogs/media.yourdomain.com.error.log
   ```

2. **检查 MinIO Bucket 权限**
   ```bash
   docker exec pis-minio mc anonymous get local/pis-photos/processed
   ```

3. **测试直接访问 MinIO**
   ```bash
   curl http://localhost:9000/pis-photos/processed/thumbs/xxx.jpg
   ```

## 性能监控

### 查看资源使用

```bash
# Docker 容器资源使用
docker stats

# 磁盘空间
df -h

# 内存使用
free -h
```

### 查看服务日志大小

```bash
# 查看日志文件大小
docker-compose logs --no-log-prefix worker | wc -l
```

## 重启服务

```bash
# 重启所有服务
cd /opt/pis/docker
docker-compose restart

# 重启单个服务
docker-compose restart worker

# 完全重建并重启 Worker
docker-compose build worker
docker-compose up -d worker
```

## 备份检查

```bash
# 检查 MinIO 数据卷
docker volume inspect pis_minio_data

# 检查 Redis 数据卷
docker volume inspect pis_redis_data
```
