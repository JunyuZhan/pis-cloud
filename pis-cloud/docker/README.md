# PIS Docker 部署指南

## 部署架构

**Vercel + Supabase + 自建 Worker**

| 组件 | 位置 | 说明 |
|------|------|------|
| **前端** | Vercel | Next.js 应用（自动部署） |
| **数据库** | Supabase Cloud | PostgreSQL 数据库和认证 |
| **存储/Worker** | 自建服务器 | MinIO + Redis + Worker 服务 |

## 快速开始（一键部署）

### 方法一：一键安装（推荐）

```bash
# 复制粘贴到终端执行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | bash
```

### 方法二：手动安装

```bash
git clone https://github.com/JunyuZhan/pis-cloud.git
cd pis-cloud/docker
bash deploy.sh
```

脚本会引导你完成：
- 配置 Supabase（数据库和认证）
- 配置域名
- 配置存储（自动生成密钥）
- 配置 Worker 服务

## 手动部署

### 1. 配置 Supabase

在 Supabase Dashboard 中：
- 创建项目
- 获取 Project URL 和 API Keys
- 在 SQL Editor 中执行 `docker/init-supabase-db.sql` 初始化数据库

### 2. 配置环境变量

```bash
# 复制并编辑配置文件
cp ../.env.example ../.env
nano ../.env

# 必须配置:
#   SUPABASE_URL=https://your-project.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
#   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 启动服务

```bash
# 启动 Worker 和存储服务
cd docker
docker compose up -d
```

### 4. 部署前端到 Vercel

- 导入 GitHub 仓库到 Vercel
- 配置环境变量（从 .env 文件）
- 部署

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f worker

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| worker | 3001 | 图片处理服务（自托管） |
| minio | 9000/9001 | 对象存储（自托管） |
| redis | 16379 | 任务队列（自托管） |
| web | Vercel | Next.js 前端（云端） |
| database | Supabase | PostgreSQL 数据库（云端） |

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs --tail=100 <服务名>

# 检查容器状态
docker compose ps -a
```

### 数据库连接失败

检查 Supabase 配置：
- 确认 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 正确
- 在 Supabase Dashboard 中检查项目状态

### MinIO 无法访问

```bash
# 检查 MinIO 健康状态
curl http://localhost:9000/minio/health/live
```

## Worker 服务配置

Worker 服务需要配置 Nginx 反向代理才能从 Vercel 访问：

```nginx
# /etc/nginx/sites-available/worker
server {
    listen 80;
    server_name worker.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

然后配置 SSL 证书（使用 Let's Encrypt 或 Cloudflare）。

## 备份与恢复

### 备份数据

```bash
# 备份 MinIO 数据（存储的图片文件）
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 数据库备份：在 Supabase Dashboard -> Database -> Backups 中操作
```

### 恢复数据

```bash
# 恢复 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio-backup.tar.gz -C /

# 数据库恢复：在 Supabase Dashboard -> Database -> Backups 中操作
```
