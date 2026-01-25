# PIS 一键部署到公网服务器指南

> 快速将 PIS 部署到公网服务器的自动化脚本

## 📋 前置要求

### 服务器要求

- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+ / 其他 Linux 发行版
- **配置**: 至少 2核2G 内存，推荐 4核4G+
- **网络**: 公网 IP，开放端口 19000, 19001, 16379, 3001 (或通过防火墙配置)
- **SSH 访问**: 确保可以通过 SSH 连接到服务器

### 本地要求

- **SSH 客户端**: 已配置 SSH 密钥或密码访问
- **项目文件**: 已克隆 PIS 项目到本地

## 🚀 快速开始

### 方法一：从 GitHub 直接部署（推荐）

**无需本地克隆代码，直接在服务器上从 GitHub 拉取！**

```bash
# 从任意位置运行（无需在项目目录）
bash <(curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy-to-server.sh)

# 或者先克隆脚本
git clone https://github.com/junyuzhan/pis.git
cd pis
bash scripts/deploy-to-server.sh
```

脚本会引导你完成：
1. 输入服务器 IP 和 SSH 用户名
2. **选择代码来源**：从 GitHub 克隆（推荐）或本地上传
3. 配置 Supabase 凭据
4. 配置 MinIO 凭据（可选，默认自动生成）
5. 自动安装 Docker、Docker Compose 和 Git
6. 从 GitHub 克隆最新代码
7. 启动服务
8. 可选配置 Nginx 反向代理和 SSL

### 方法二：命令行参数

```bash
# 指定服务器 IP、用户名、GitHub 仓库和分支
bash scripts/deploy-to-server.sh <服务器IP> <SSH用户名> [GitHub仓库] [分支]

# 示例（使用默认仓库）
bash scripts/deploy-to-server.sh 192.168.1.100 root

# 示例（指定自定义仓库和分支）
bash scripts/deploy-to-server.sh 192.168.1.100 root https://github.com/your-username/pis.git main
```

### 方法三：本地上传部署

如果你已经在本地修改了代码，可以选择本地上传方式：

```bash
# 在项目根目录运行
bash scripts/deploy-to-server.sh

# 选择 "2) 从本地上传"
```

## 📝 部署流程

### 1. 准备 Supabase 配置

在运行部署脚本前，请准备好：

- **Supabase Project URL**: `https://xxxxx.supabase.co`
- **Supabase Service Role Key**: 从 Supabase Dashboard → Settings → API 获取

> 💡 **提示**: 确保已在 Supabase 中执行了数据库迁移（参考 [部署指南](./DEPLOYMENT.md#supabase-配置)）

### 2. 运行部署脚本

```bash
# 方式一：直接从 GitHub 拉取脚本（推荐）
bash <(curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy-to-server.sh)

# 方式二：本地运行（如果已克隆项目）
cd /path/to/pis
bash scripts/deploy-to-server.sh
```

### 3. 按提示输入信息

脚本会依次询问：

```
请输入服务器 IP 地址: 192.168.1.100
请输入 SSH 用户名 [默认: root]: root

选择代码来源:
  1) 从 GitHub 克隆 (推荐)
  2) 从本地上传
请选择 [1-2]: 1

GitHub 仓库地址 [默认: https://github.com/junyuzhan/pis.git]: [回车使用默认]
分支名称 [默认: main]: [回车使用默认]

Supabase Project URL: https://xxxxx.supabase.co
Supabase Service Role Key: eyJhbGciOiJIUzI1NiIs...
MinIO Access Key [默认: 自动生成]: [回车使用自动生成]
MinIO Secret Key [默认: 自动生成]: [回车使用自动生成]
是否配置 Nginx 反向代理? [y/N]: y
请输入媒体域名 (例: media.example.com): media.example.com
选择 SSL 配置方式 [1-3]: 1
```

### 4. 等待部署完成

脚本会自动完成：

- ✅ 检查并安装 Docker
- ✅ 检查并安装 Docker Compose
- ✅ 检查端口占用情况
- ✅ 创建部署目录结构
- ✅ 上传项目文件
- ✅ 配置环境变量
- ✅ 构建 Worker 镜像
- ✅ 启动所有服务
- ✅ 验证服务健康状态
- ✅ 配置 Nginx（可选）
- ✅ 配置 SSL 证书（可选）

## 🔧 部署后配置

### 1. 访问 MinIO 控制台

部署完成后，你可以通过以下地址访问 MinIO 控制台：

```
http://你的服务器IP:19001
```

使用部署时配置的 Access Key 和 Secret Key 登录。

### 2. 配置前端环境变量

在 Vercel 或其他前端托管平台配置以下环境变量：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon-key
SUPABASE_SERVICE_ROLE_KEY=你的service-role-key

# 应用配置
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# 媒体存储配置（如果配置了 Nginx）
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos

# 或者直接使用 IP（不推荐生产环境）
NEXT_PUBLIC_MEDIA_URL=http://你的服务器IP:19000/pis-photos

# Worker 配置
NEXT_PUBLIC_WORKER_URL=http://你的服务器IP:3001
```

### 3. 部署前端到 Vercel

参考 [部署指南](./DEPLOYMENT.md#vercel-部署) 将前端部署到 Vercel。

## 🛠️ 常用运维命令

### 查看服务状态

```bash
ssh user@server 'cd /opt/pis/docker && docker-compose ps'
```

### 查看日志

```bash
# 查看所有服务日志
ssh user@server 'cd /opt/pis/docker && docker-compose logs -f'

# 查看特定服务日志
ssh user@server 'cd /opt/pis/docker && docker-compose logs -f worker'
ssh user@server 'cd /opt/pis/docker && docker-compose logs -f minio'
```

### 重启服务

```bash
# 重启所有服务
ssh user@server 'cd /opt/pis/docker && docker-compose restart'

# 重启特定服务
ssh user@server 'cd /opt/pis/docker && docker-compose restart worker'
```

### 停止服务

```bash
ssh user@server 'cd /opt/pis/docker && docker-compose down'
```

### 更新 Worker 代码

```bash
# 1. 在本地修改代码后，重新上传
scp -r services/worker/src user@server:/opt/pis/services/worker/

# 2. 在服务器上重新构建并启动
ssh user@server 'cd /opt/pis/docker && docker-compose build worker && docker-compose up -d worker'
```

## 🔒 安全建议

### 1. 修改默认端口（可选）

如果默认端口被占用或需要更安全，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "自定义端口:9000"  # MinIO API
  - "自定义端口:9001"  # MinIO Console
```

### 2. 配置防火墙

```bash
# Ubuntu/Debian
sudo ufw allow 19000/tcp
sudo ufw allow 19001/tcp
sudo ufw allow 3001/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=19000/tcp
sudo firewall-cmd --permanent --add-port=19001/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### 3. 使用强密码

部署脚本会自动生成随机密码，请妥善保存。如果需要修改：

```bash
ssh user@server
cd /opt/pis
nano .env  # 修改 MINIO_ACCESS_KEY 和 MINIO_SECRET_KEY
cd docker
docker-compose restart
```

### 4. 限制 MinIO Console 访问

生产环境建议将 MinIO Console 端口（19001）仅绑定到 localhost，通过 SSH 隧道访问：

```yaml
# 修改 docker-compose.yml
ports:
  - "127.0.0.1:19001:9001"  # 仅本地访问
```

然后通过 SSH 隧道访问：

```bash
ssh -L 19001:localhost:19001 user@server
# 然后在浏览器访问 http://localhost:19001
```

## ❓ 常见问题

### Q: 部署失败，提示 "Docker 未安装"

**A**: 脚本会自动尝试安装 Docker，如果失败，请手动安装：

```bash
curl -fsSL https://get.docker.com | sh
```

### Q: 端口被占用怎么办？

**A**: 脚本会检查端口占用情况。如果端口被占用，可以：

1. 停止占用端口的服务
2. 修改 `docker-compose.yml` 中的端口映射

### Q: Worker 构建失败

**A**: 可能的原因：

1. **网络问题**: 检查服务器是否能访问 Docker Hub
2. **内存不足**: Worker 构建需要足够内存，建议至少 2G
3. **磁盘空间不足**: 检查磁盘空间 `df -h`

解决方案：

```bash
# 查看构建日志
ssh user@server 'cd /opt/pis/docker && docker-compose build worker'

# 清理 Docker 缓存
ssh user@server 'docker system prune -a'
```

### Q: 如何更新到最新版本？

**A**: 

如果是从 GitHub 克隆的代码，更新非常简单：

```bash
# 在服务器上直接拉取最新代码并重启服务
ssh user@server 'cd /opt/pis && git pull && cd docker && docker-compose build worker && docker-compose up -d'
```

或者重新运行部署脚本（会备份旧版本）：

```bash
bash scripts/deploy-to-server.sh <服务器IP> <用户名>
```

如果是本地上传方式：

```bash
# 1. 在本地拉取最新代码
git pull

# 2. 重新运行部署脚本（会覆盖现有文件）
bash scripts/deploy-to-server.sh <服务器IP> <用户名>

# 3. 或者手动更新特定文件
scp docker/docker-compose.yml user@server:/opt/pis/docker/
scp -r services/worker/src user@server:/opt/pis/services/worker/
ssh user@server 'cd /opt/pis/docker && docker-compose build worker && docker-compose up -d'
```

### Q: 可以使用私有仓库吗？

**A**: 可以！在脚本提示输入 GitHub 仓库地址时，输入你的私有仓库地址：

```
GitHub 仓库地址: https://github.com/your-username/your-private-repo.git
```

如果仓库需要认证，确保服务器上已配置 SSH 密钥或使用 HTTPS 认证：

```bash
# 在服务器上配置 Git 凭据
ssh user@server 'git config --global credential.helper store'
# 然后手动克隆一次以保存凭据
```

### Q: 如何备份数据？

**A**: 

```bash
# 备份 MinIO 数据
ssh user@server 'docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz -C /data .'

# 备份 Redis 数据
ssh user@server 'docker exec pis-redis redis-cli SAVE && docker cp pis-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb'
```

### Q: 服务无法启动

**A**: 检查步骤：

1. 查看服务日志：`docker-compose logs`
2. 检查环境变量：`cat /opt/pis/.env`
3. 检查端口占用：`ss -tuln | grep -E ":(19000|19001|16379|3001)"`
4. 检查 Docker 服务：`systemctl status docker`

## 📚 相关文档

- [完整部署指南](./DEPLOYMENT.md) - 详细的部署步骤和配置说明
- [存储配置](./STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 配置指南
- [数据库配置](./DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL 配置指南
- [安全指南](../../SECURITY.md) - 安全最佳实践

## 🆘 获取帮助

如果遇到问题：

1. 查看本文档的常见问题部分
2. 查看 [GitHub Issues](https://github.com/junyuzhan/pis/issues)
3. 提交新 Issue，附上：
   - 错误日志
   - 服务器环境信息
   - 部署步骤

---

**祝部署顺利！** 🎉
