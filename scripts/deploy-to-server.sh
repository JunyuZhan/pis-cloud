#!/bin/bash

# ============================================
# PIS 一键部署到公网服务器脚本
# 用途: 自动化部署 PIS 到远程服务器
# 使用方法: bash scripts/deploy-to-server.sh [服务器IP] [SSH用户]
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# 参数
SSH_HOST=${1:-""}
SSH_USER=${2:-"root"}
DEPLOY_DIR="/opt/pis"
GITHUB_REPO=${3:-""}
GITHUB_BRANCH=${4:-"main"}

# 检查参数
if [ -z "$SSH_HOST" ]; then
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   📸 PIS - 一键部署到公网服务器                            ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    read -p "请输入服务器 IP 地址: " SSH_HOST
    read -p "请输入 SSH 用户名 [默认: root]: " SSH_USER_INPUT
    SSH_USER=${SSH_USER_INPUT:-$SSH_USER}
    
    echo ""
    echo "选择代码来源:"
    echo "  1) 从 GitHub 克隆 (推荐)"
    echo "  2) 从本地上传"
    read -p "请选择 [1-2]: " CODE_SOURCE
    
    if [ "$CODE_SOURCE" = "1" ]; then
        read -p "GitHub 仓库地址 [默认: https://github.com/junyuzhan/pis.git]: " GITHUB_REPO_INPUT
        GITHUB_REPO=${GITHUB_REPO_INPUT:-"https://github.com/junyuzhan/pis.git"}
        read -p "分支名称 [默认: main]: " GITHUB_BRANCH_INPUT
        GITHUB_BRANCH=${GITHUB_BRANCH_INPUT:-"main"}
        USE_GITHUB=true
    else
        USE_GITHUB=false
        # 检查本地文件
        if [ ! -f "docker/docker-compose.yml" ]; then
            error "未找到 docker/docker-compose.yml，请在项目根目录运行此脚本"
            exit 1
        fi
    fi
else
    # 命令行模式，默认使用 GitHub
    if [ -z "$GITHUB_REPO" ]; then
        GITHUB_REPO="https://github.com/junyuzhan/pis.git"
    fi
    USE_GITHUB=true
fi

echo ""
info "部署目标: ${SSH_USER}@${SSH_HOST}"
info "部署目录: ${DEPLOY_DIR}"
if [ "$USE_GITHUB" = true ]; then
    info "代码来源: GitHub (${GITHUB_REPO}, 分支: ${GITHUB_BRANCH})"
else
    info "代码来源: 本地上传"
fi
echo ""

# 测试 SSH 连接
step "测试 SSH 连接"
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${SSH_USER}@${SSH_HOST} "echo 'SSH连接成功'" 2>/dev/null; then
    success "SSH 连接正常"
else
    warn "SSH 连接测试失败，将提示输入密码"
    read -p "按回车继续，或 Ctrl+C 取消..."
fi

# 检查并安装 Docker
step "检查服务器环境"
ssh ${SSH_USER}@${SSH_HOST} << 'EOF'
    # 检查 Docker
    if command -v docker &> /dev/null; then
        echo "✓ Docker 已安装: $(docker --version)"
    else
        echo "⚠ Docker 未安装，开始安装..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        echo "✓ Docker 安装完成"
    fi
    
    # 检查 Docker Compose
    if docker compose version &> /dev/null || command -v docker-compose &> /dev/null; then
        echo "✓ Docker Compose 已安装"
    else
        echo "⚠ Docker Compose 未安装，开始安装..."
        DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
        curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        echo "✓ Docker Compose 安装完成"
    fi
    
    # 检查端口占用
    echo ""
    echo "检查端口占用情况..."
    for port in 19000 19001 16379 3001; do
        if ss -tuln 2>/dev/null | grep -q ":${port} " || netstat -tuln 2>/dev/null | grep -q ":${port} "; then
            echo "⚠ 端口 ${port} 已被占用"
        else
            echo "✓ 端口 ${port} 可用"
        fi
    done
EOF

# 准备代码
if [ "$USE_GITHUB" = true ]; then
    step "从 GitHub 克隆代码"
    ssh ${SSH_USER}@${SSH_HOST} << EOF
        # 检查 Git 是否安装
        if ! command -v git &> /dev/null; then
            echo "⚠ Git 未安装，开始安装..."
            if command -v apt-get &> /dev/null; then
                apt-get update && apt-get install -y git
            elif command -v yum &> /dev/null; then
                yum install -y git
            else
                echo "✗ 无法自动安装 Git，请手动安装"
                exit 1
            fi
        fi
        
        # 如果目录已存在，备份并删除
        if [ -d "${DEPLOY_DIR}" ]; then
            echo "⚠ 部署目录已存在，备份为 ${DEPLOY_DIR}.backup.\$(date +%Y%m%d_%H%M%S)"
            mv ${DEPLOY_DIR} ${DEPLOY_DIR}.backup.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        fi
        
        # 克隆代码
        echo "正在从 GitHub 克隆代码..."
        git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${DEPLOY_DIR} || {
            echo "✗ 代码克隆失败"
            exit 1
        }
        
        echo "✓ 代码克隆完成"
        
        # 显示当前提交信息
        cd ${DEPLOY_DIR}
        echo "当前版本: \$(git rev-parse --short HEAD)"
        echo "当前分支: \$(git branch --show-current)"
EOF
    success "代码准备完成"
else
    # 从本地上传
    step "准备部署目录"
    ssh ${SSH_USER}@${SSH_HOST} << EOF
        mkdir -p ${DEPLOY_DIR}/docker
        mkdir -p ${DEPLOY_DIR}/services/worker
        echo "✓ 目录结构已创建"
EOF

    step "上传项目文件"
    info "上传 docker-compose.yml..."
    scp docker/docker-compose.yml ${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/docker/ || {
        error "docker-compose.yml 上传失败"
        exit 1
    }

    info "上传 worker.Dockerfile..."
    if [ -f "docker/worker.Dockerfile" ]; then
        scp docker/worker.Dockerfile ${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/docker/ || warn "worker.Dockerfile 上传失败"
    else
        warn "worker.Dockerfile 不存在，跳过"
    fi

    info "上传 Worker 配置文件..."
    if [ -f "services/worker/package.json" ]; then
        scp services/worker/package.json ${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/services/worker/ || {
            error "package.json 上传失败"
            exit 1
        }
    else
        error "services/worker/package.json 不存在"
        exit 1
    fi

    if [ -f "services/worker/tsconfig.json" ]; then
        scp services/worker/tsconfig.json ${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/services/worker/ || warn "tsconfig.json 上传失败"
    fi

    info "上传 Worker 源码..."
    if [ -d "services/worker/src" ]; then
        # 使用 tar 压缩传输，更可靠
        tar czf /tmp/pis-worker-src.tar.gz -C services/worker src 2>/dev/null || {
            error "Worker 源码打包失败"
            exit 1
        }
        scp /tmp/pis-worker-src.tar.gz ${SSH_USER}@${SSH_HOST}:/tmp/ || {
            error "Worker 源码上传失败"
            exit 1
        }
        ssh ${SSH_USER}@${SSH_HOST} "cd ${DEPLOY_DIR}/services/worker && tar xzf /tmp/pis-worker-src.tar.gz && rm /tmp/pis-worker-src.tar.gz" || {
            error "Worker 源码解压失败"
            exit 1
        }
        rm /tmp/pis-worker-src.tar.gz
    else
        error "services/worker/src 目录不存在"
        exit 1
    fi

    success "文件上传完成"
fi

# 配置环境变量
step "配置环境变量"
echo "请提供以下配置信息："
echo ""

read -p "Supabase Project URL: " SUPABASE_URL
read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY
read -p "MinIO Access Key [默认: 自动生成]: " MINIO_ACCESS_KEY_INPUT
read -p "MinIO Secret Key [默认: 自动生成]: " MINIO_SECRET_KEY_INPUT

# 生成随机密码（如果未提供）
if [ -z "$MINIO_ACCESS_KEY_INPUT" ]; then
    MINIO_ACCESS_KEY=$(openssl rand -hex 8)
    info "已自动生成 MinIO Access Key"
else
    MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY_INPUT
fi

if [ -z "$MINIO_SECRET_KEY_INPUT" ]; then
    MINIO_SECRET_KEY=$(openssl rand -hex 16)
    info "已自动生成 MinIO Secret Key"
else
    MINIO_SECRET_KEY=$MINIO_SECRET_KEY_INPUT
fi

# 创建 .env 文件
ssh ${SSH_USER}@${SSH_HOST} << EOF
cat > ${DEPLOY_DIR}/.env << ENVEOF
# ===========================================
# PIS 生产环境配置
# ===========================================

# Supabase 配置
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}

# MinIO 配置
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379

# Worker 配置
HTTP_PORT=3001
ENVEOF
echo "✓ 环境变量文件已创建"
EOF

success "环境变量配置完成"
echo ""
info "MinIO 凭据 (请保存):"
echo "  Access Key: ${MINIO_ACCESS_KEY}"
echo "  Secret Key: ${MINIO_SECRET_KEY}"
echo ""

# 停止旧服务（如果存在）
step "停止旧服务"
ssh ${SSH_USER}@${SSH_HOST} << EOF
    cd ${DEPLOY_DIR}/docker 2>/dev/null || exit 0
    if [ -f "docker-compose.yml" ]; then
        docker-compose down 2>/dev/null || true
        echo "✓ 旧服务已停止"
    fi
EOF

# 构建并启动服务
step "构建并启动服务"
ssh ${SSH_USER}@${SSH_HOST} << EOF
    cd ${DEPLOY_DIR}/docker
    
    # 确保 docker-compose.yml 存在
    if [ ! -f "docker-compose.yml" ]; then
        echo "✗ docker-compose.yml 不存在"
        exit 1
    fi
    
    # 构建 Worker 镜像
    echo "构建 Worker 镜像..."
    docker-compose build worker || {
        echo "⚠ Worker 构建失败，尝试直接启动..."
    }
    
    # 启动所有服务
    echo "启动服务..."
    docker-compose up -d
    
    echo "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    echo ""
    echo "服务状态:"
    docker-compose ps
    
    # 显示代码版本信息（如果是从 GitHub 克隆）
    if [ -d "${DEPLOY_DIR}/.git" ]; then
        echo ""
        echo "代码版本信息:"
        cd ${DEPLOY_DIR}
        echo "  仓库: \$(git remote get-url origin)"
        echo "  分支: \$(git branch --show-current)"
        echo "  提交: \$(git rev-parse --short HEAD)"
        echo "  时间: \$(git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M:%S')"
    fi
EOF

# 验证服务
step "验证服务"
ssh ${SSH_USER}@${SSH_HOST} << EOF
    cd ${DEPLOY_DIR}/docker
    
    echo "健康检查:"
    echo -n "MinIO: "
    curl -s http://localhost:19000/minio/health/live && echo " ✓" || echo " ✗"
    
    echo -n "Redis: "
    docker exec pis-redis redis-cli ping 2>/dev/null && echo " ✓" || echo " ✗"
    
    echo -n "Worker: "
    curl -s http://localhost:3001/health && echo " ✓" || echo " ✗"
    
    echo ""
    echo "端口监听状态:"
    ss -tuln 2>/dev/null | grep -E ":(19000|19001|16379|3001) " || netstat -tuln 2>/dev/null | grep -E ":(19000|19001|16379|3001) " || echo "未检测到监听端口"
EOF

# 询问是否配置 Nginx
step "Nginx 反向代理配置"
read -p "是否配置 Nginx 反向代理? [y/N]: " CONFIGURE_NGINX

if [[ "$CONFIGURE_NGINX" =~ ^[Yy]$ ]]; then
    read -p "请输入媒体域名 (例: media.example.com): " MEDIA_DOMAIN
    
    if [ -n "$MEDIA_DOMAIN" ]; then
        ssh ${SSH_USER}@${SSH_HOST} << EOF
            # 检查 Nginx 是否安装
            if ! command -v nginx &> /dev/null; then
                echo "⚠ Nginx 未安装，开始安装..."
                if command -v apt-get &> /dev/null; then
                    apt-get update
                    apt-get install -y nginx
                elif command -v yum &> /dev/null; then
                    yum install -y nginx
                else
                    echo "✗ 无法自动安装 Nginx，请手动安装"
                    exit 1
                fi
            fi
            
            # 创建 Nginx 配置
            cat > /etc/nginx/sites-available/pis-media << NGINXEOF
server {
    listen 80;
    server_name ${MEDIA_DOMAIN};
    
    # 允许大文件上传
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://127.0.0.1:19000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 缓存静态资源
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
        
        # CORS
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    }
}
NGINXEOF
            
            # 启用配置
            ln -sf /etc/nginx/sites-available/pis-media /etc/nginx/sites-enabled/
            nginx -t && systemctl reload nginx
            
            echo "✓ Nginx 配置完成"
            
            # 询问是否配置 SSL
            echo ""
            echo "SSL 证书配置:"
            echo "  1. 使用 Let's Encrypt (certbot)"
            echo "  2. 手动配置"
            echo "  3. 跳过"
EOF
        
        read -p "选择 SSL 配置方式 [1-3]: " SSL_CHOICE
        case $SSL_CHOICE in
            1)
                info "配置 Let's Encrypt SSL..."
                ssh ${SSH_USER}@${SSH_HOST} << EOF
                    if ! command -v certbot &> /dev/null; then
                        if command -v apt-get &> /dev/null; then
                            apt-get install -y certbot python3-certbot-nginx
                        elif command -v yum &> /dev/null; then
                            yum install -y certbot python3-certbot-nginx
                        fi
                    fi
                    
                    certbot --nginx -d ${MEDIA_DOMAIN} --non-interactive --agree-tos --email admin@${MEDIA_DOMAIN} || {
                        echo "⚠ SSL 配置失败，请手动运行: certbot --nginx -d ${MEDIA_DOMAIN}"
                    }
EOF
                ;;
            2)
                info "请手动配置 SSL 证书"
                ;;
        esac
    fi
fi

# 显示部署信息
step "部署完成"
echo ""
success "PIS 已成功部署到服务器!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 部署信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "服务器地址: ${SSH_USER}@${SSH_HOST}"
echo "部署目录: ${DEPLOY_DIR}"
echo ""
echo "服务端口:"
echo "  - MinIO API: 19000"
echo "  - MinIO Console: 19001"
echo "  - Redis: 16379"
echo "  - Worker API: 3001"
echo ""
echo "MinIO 凭据:"
echo "  Access Key: ${MINIO_ACCESS_KEY}"
echo "  Secret Key: ${MINIO_SECRET_KEY}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 下一步操作"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 访问 MinIO 控制台:"
echo "   http://${SSH_HOST}:19001"
echo "   用户名: ${MINIO_ACCESS_KEY}"
echo "   密码: ${MINIO_SECRET_KEY}"
echo ""
echo "2. 配置前端环境变量 (Vercel/其他平台):"
echo "   NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}"
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=<从 Supabase 获取>"
echo "   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}"
echo "   NEXT_PUBLIC_APP_URL=https://yourdomain.com"
if [ -n "$MEDIA_DOMAIN" ]; then
    echo "   NEXT_PUBLIC_MEDIA_URL=https://${MEDIA_DOMAIN}/pis-photos"
else
    echo "   NEXT_PUBLIC_MEDIA_URL=http://${SSH_HOST}:19000/pis-photos"
fi
echo "   NEXT_PUBLIC_WORKER_URL=http://${SSH_HOST}:3001"
echo ""
echo "3. 常用命令:"
echo "   查看日志: ssh ${SSH_USER}@${SSH_HOST} 'cd ${DEPLOY_DIR}/docker && docker-compose logs -f'"
echo "   重启服务: ssh ${SSH_USER}@${SSH_HOST} 'cd ${DEPLOY_DIR}/docker && docker-compose restart'"
echo "   停止服务: ssh ${SSH_USER}@${SSH_HOST} 'cd ${DEPLOY_DIR}/docker && docker-compose down'"
if [ "$USE_GITHUB" = true ]; then
    echo "   更新代码: ssh ${SSH_USER}@${SSH_HOST} 'cd ${DEPLOY_DIR} && git pull && cd docker && docker-compose build worker && docker-compose up -d'"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
