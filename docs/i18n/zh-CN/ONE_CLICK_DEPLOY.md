# PIS 一键部署指南

## 🚀 最简单的方式

**SSH 登录到你的服务器，然后运行：**

```bash
# 方式 1：先下载再执行（推荐，支持交互式输入）
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh

# 方式 2：直接管道执行（需要设置环境变量）
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
```

脚本会自动：
- 安装 Docker、Docker Compose、Git
- 下载最新代码
- 引导你选择数据库和网络模式
- 启动所有服务

## 📋 部署流程

```
第 1 步：安装环境（Docker、Git）
第 2 步：获取代码
第 3 步：选择数据库（Supabase/PostgreSQL/MySQL）
第 4 步：选择网络模式（内网/公网）
第 5 步：配置数据库凭据
第 6 步：启动服务
第 7 步：验证服务
```

## 🗄️ 数据库选择

| 类型 | 推荐场景 | 特点 |
|------|---------|------|
| **Supabase** | 生产环境（推荐） | 云端托管，包含用户认证 |
| **PostgreSQL** | 自建环境 | 本地 Docker |
| **MySQL** | 自建环境 | 本地 Docker |

### Supabase 配置获取

1. 访问 https://supabase.com/dashboard
2. 选择项目 → **Settings** → **API**
3. 复制 **Project URL** 和 **service_role key**

## 📋 服务器要求

- **系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+
- **配置**: 2核2G+，推荐 4核4G
- **端口**: 19000, 19001, 3001（公网模式）

## 🔧 其他部署方式

### 本地远程部署

如果你想从本地电脑部署到远程服务器：

```bash
# 克隆项目
git clone https://github.com/junyuzhan/pis.git
cd pis

# 远程部署（替换为你的服务器IP和用户名）
bash scripts/deploy.sh your-server-ip root
```

### 使用环境变量

提前设置环境变量可以跳过输入：

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
```

## 🔧 部署后配置

### 1. 访问 MinIO 控制台

```
http://服务器IP:19001
```

### 2. 初始化数据库架构（Supabase）

⚠️ **重要提示**：在 Supabase Dashboard → SQL Editor 中执行 `database/full_schema.sql` **一次**即可。此文件仅适用于**全新的数据库**。

### 3. 配置前端环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<从 Dashboard 获取>
NEXT_PUBLIC_MEDIA_URL=http://服务器IP:19000/pis-photos
NEXT_PUBLIC_WORKER_URL=http://服务器IP:3001
```

## 🛠️ 常用命令

```bash
# 查看日志
cd /opt/pis/docker && docker-compose logs -f

# 重启服务
cd /opt/pis/docker && docker-compose restart

# 更新代码
cd /opt/pis && git pull && cd docker && docker-compose up -d --build
```

## ❓ 常见问题

**Q: 部署失败怎么办？**

```bash
cd /opt/pis/docker && docker-compose logs
```

**Q: 端口被占用？**

```bash
ss -tuln | grep -E ":(19000|19001|3001)"
```

---

**有问题？** [GitHub Issues](https://github.com/junyuzhan/pis/issues)
