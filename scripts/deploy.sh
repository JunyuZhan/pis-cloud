#!/bin/bash

# ============================================
# PIS 一键部署系统
# 
# 两种使用方式：
# 
# 1. 在服务器上直接运行（推荐）：
#    curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
#    
# 2. 在本地运行，远程部署：
#    git clone https://github.com/junyuzhan/pis.git && cd pis
#    bash scripts/deploy.sh <服务器IP> [用户名]
# ============================================

set -e

# 检测是否为交互式终端
if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
    warn "检测到非交互式模式，将使用环境变量或默认值"
fi

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# 配置
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pis}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/junyuzhan/pis.git}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

# 打印标题
print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   📸 PIS - 一键部署系统                                    ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 生成随机密码
generate_password() {
    openssl rand -hex ${1:-16}
}

# 检测运行模式
detect_mode() {
    if [ -n "$1" ]; then
        # 有参数，是远程部署模式
        echo "remote"
    elif [ -f "/etc/os-release" ] && [ ! -d ".git" ]; then
        # 在服务器上直接运行
        echo "local"
    elif [ -d "scripts/deploy" ]; then
        # 在项目目录中运行，但没有指定服务器
        echo "need_server"
    else
        echo "local"
    fi
}

# ============================================
# 本地模式：直接在当前服务器上部署
# ============================================
deploy_local() {
    print_header
    echo -e "${BOLD}模式：在当前服务器上部署${NC}"
    echo ""
    
    # 检查是否是 root
    if [ "$EUID" -ne 0 ]; then
        warn "建议使用 root 用户运行，或使用 sudo"
    fi
    
    # ===== 安装 Docker =====
    echo ""
    echo -e "${BOLD}第 1 步：安装环境${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if command -v docker &> /dev/null; then
        success "Docker 已安装: $(docker --version)"
    else
        info "安装 Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        success "Docker 安装完成"
    fi
    
    if docker compose version &> /dev/null || command -v docker-compose &> /dev/null; then
        success "Docker Compose 已安装"
    else
        info "安装 Docker Compose..."
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        success "Docker Compose 安装完成"
    fi
    
    if command -v git &> /dev/null; then
        success "Git 已安装"
    else
        info "安装 Git..."
        if command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y git
        elif command -v yum &> /dev/null; then
            yum install -y git
        fi
        success "Git 安装完成"
    fi
    
    # ===== 克隆代码 =====
    echo ""
    echo -e "${BOLD}第 2 步：获取代码${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -d "${DEPLOY_DIR}" ]; then
        warn "目录 ${DEPLOY_DIR} 已存在"
        if [ "$INTERACTIVE" = true ]; then
            read -p "是否备份并重新克隆? [y/N]: " RECLONE
        else
            RECLONE="N"  # 非交互式默认不重新克隆
        fi
        if [[ "$RECLONE" =~ ^[Yy]$ ]]; then
            mv ${DEPLOY_DIR} ${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)
            git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${DEPLOY_DIR}
            success "代码克隆完成"
        else
            info "使用现有代码"
            cd ${DEPLOY_DIR} && git pull || true
        fi
    else
        git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${DEPLOY_DIR}
        success "代码克隆完成"
    fi
    
    cd ${DEPLOY_DIR}
    
    # ===== 选择数据库 =====
    echo ""
    echo -e "${BOLD}第 3 步：选择数据库${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1) Supabase 云数据库 ${GREEN}(推荐)${NC}"
    echo "  2) PostgreSQL (本地 Docker)"
    echo "  3) MySQL (本地 Docker)"
    echo ""
    
    if [ "$INTERACTIVE" = true ]; then
        read -p "请选择 [1-3，默认: 1]: " DB_CHOICE
    else
        DB_CHOICE=${DATABASE_TYPE:-1}
        [ "$DB_CHOICE" = "supabase" ] && DB_CHOICE=1
        [ "$DB_CHOICE" = "postgresql" ] && DB_CHOICE=2
        [ "$DB_CHOICE" = "mysql" ] && DB_CHOICE=3
        echo "使用环境变量或默认值: $DB_CHOICE"
    fi
    DB_CHOICE=${DB_CHOICE:-1}
    
    # ===== 选择网络模式 =====
    echo ""
    echo -e "${BOLD}第 4 步：选择网络模式${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1) 内网模式 - Worker 仅本地访问"
    echo "  2) 公网模式 ${GREEN}(推荐)${NC} - Worker 可公网访问"
    echo ""
    
    if [ "$INTERACTIVE" = true ]; then
        read -p "请选择 [1-2，默认: 2]: " NET_CHOICE
    else
        NET_CHOICE=${NETWORK_MODE:-2}
        [ "$NET_CHOICE" = "local" ] && NET_CHOICE=1
        [ "$NET_CHOICE" = "public" ] && NET_CHOICE=2
        echo "使用环境变量或默认值: $NET_CHOICE"
    fi
    NET_CHOICE=${NET_CHOICE:-2}
    
    WORKER_BIND="127.0.0.1"
    [ "$NET_CHOICE" = "2" ] && WORKER_BIND="0.0.0.0"
    
    # ===== 配置数据库 =====
    echo ""
    echo -e "${BOLD}第 5 步：配置数据库${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 生成 MinIO 密钥
    MINIO_ACCESS_KEY=$(generate_password 8)
    MINIO_SECRET_KEY=$(generate_password 16)
    
    case $DB_CHOICE in
        1)
            # Supabase
            echo ""
            echo "请提供 Supabase 配置 (从 Dashboard → Settings → API 获取)："
            echo ""
            
            if [ -n "$SUPABASE_URL" ]; then
                info "使用环境变量 SUPABASE_URL"
            elif [ "$INTERACTIVE" = true ]; then
                read -p "Supabase Project URL: " SUPABASE_URL
            else
                error "非交互式模式需要设置 SUPABASE_URL 环境变量"
                exit 1
            fi
            
            if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
                info "使用环境变量 SUPABASE_SERVICE_ROLE_KEY"
            elif [ "$INTERACTIVE" = true ]; then
                read -p "Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
            else
                error "非交互式模式需要设置 SUPABASE_SERVICE_ROLE_KEY 环境变量"
                exit 1
            fi
            
            if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
                error "Supabase 配置不能为空"
                exit 1
            fi
            
            # 创建 .env
            cat > ${DEPLOY_DIR}/.env << EOF
# PIS 配置 - Supabase
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos

REDIS_HOST=redis
REDIS_PORT=6379
HTTP_PORT=3001
WORKER_BIND_HOST=${WORKER_BIND}
EOF
            
            # 使用 Supabase docker-compose
            cp docker/docker-compose.yml docker/docker-compose.yml.active
            ;;
            
        2)
            # PostgreSQL
            DB_PASSWORD=$(generate_password 16)
            
            cat > ${DEPLOY_DIR}/.env << EOF
# PIS 配置 - PostgreSQL
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

DATABASE_TYPE=postgresql
DATABASE_HOST=postgresql
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis_user
DATABASE_PASSWORD=${DB_PASSWORD}
DATABASE_SSL=false

MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos

REDIS_HOST=redis
REDIS_PORT=6379
HTTP_PORT=3001
WORKER_BIND_HOST=${WORKER_BIND}
EOF
            
            cp docker/docker-compose.postgresql.yml docker/docker-compose.yml.active
            info "PostgreSQL 密码: ${DB_PASSWORD}"
            ;;
            
        3)
            # MySQL
            DB_PASSWORD=$(generate_password 16)
            
            cat > ${DEPLOY_DIR}/.env << EOF
# PIS 配置 - MySQL
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

DATABASE_TYPE=mysql
DATABASE_HOST=mysql
DATABASE_PORT=3306
DATABASE_NAME=pis
DATABASE_USER=pis_user
DATABASE_PASSWORD=${DB_PASSWORD}
DATABASE_SSL=false

MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos

REDIS_HOST=redis
REDIS_PORT=6379
HTTP_PORT=3001
WORKER_BIND_HOST=${WORKER_BIND}
EOF
            
            cp docker/docker-compose.mysql.yml docker/docker-compose.yml.active
            info "MySQL 密码: ${DB_PASSWORD}"
            ;;
    esac
    
    success "配置文件已创建: ${DEPLOY_DIR}/.env"
    
    # ===== 启动服务 =====
    echo ""
    echo -e "${BOLD}第 6 步：启动服务${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd ${DEPLOY_DIR}/docker
    
    # 使用对应的 docker-compose 文件
    if [ -f "docker-compose.yml.active" ]; then
        cp docker-compose.yml.active docker-compose.yml
    fi
    
    docker-compose down 2>/dev/null || true
    
    info "构建 Worker 镜像..."
    docker-compose build worker
    
    info "启动服务..."
    docker-compose up -d
    
    echo ""
    info "等待服务启动..."
    sleep 10
    
    # ===== 验证服务 =====
    echo ""
    echo -e "${BOLD}第 7 步：验证服务${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo ""
    docker-compose ps
    echo ""
    
    echo "健康检查:"
    echo -n "  MinIO: "
    curl -s http://localhost:19000/minio/health/live && echo " ✓" || echo " ✗"
    
    echo -n "  Redis: "
    docker exec pis-redis redis-cli ping 2>/dev/null && echo " ✓" || echo " ✗"
    
    echo -n "  Worker: "
    curl -s http://localhost:3001/health && echo " ✓" || echo " ✗"
    
    # ===== 完成 =====
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}${BOLD}🎉 部署完成！${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📦 MinIO Console: http://$(hostname -I | awk '{print $1}'):19001"
    echo "   用户名: ${MINIO_ACCESS_KEY}"
    echo "   密码: ${MINIO_SECRET_KEY}"
    echo ""
    
    if [ "$WORKER_BIND" = "0.0.0.0" ]; then
        echo "🔧 Worker API: http://$(hostname -I | awk '{print $1}'):3001"
    else
        echo "🔧 Worker API: http://127.0.0.1:3001 (仅本地访问)"
    fi
    echo ""
    
    echo "📝 常用命令:"
    echo "   查看日志: cd ${DEPLOY_DIR}/docker && docker-compose logs -f"
    echo "   重启服务: cd ${DEPLOY_DIR}/docker && docker-compose restart"
    echo ""
}

# ============================================
# 远程模式：通过 SSH 部署到远程服务器
# ============================================
deploy_remote() {
    local SSH_HOST=$1
    local SSH_USER=${2:-root}
    
    print_header
    echo -e "${BOLD}模式：远程部署到 ${SSH_USER}@${SSH_HOST}${NC}"
    echo ""
    
    # 测试 SSH 连接
    info "测试 SSH 连接..."
    if ssh -o ConnectTimeout=5 -o BatchMode=yes ${SSH_USER}@${SSH_HOST} "echo OK" 2>/dev/null; then
        success "SSH 连接正常"
    else
        warn "SSH 密钥认证失败，将提示输入密码"
    fi
    
    # 获取本脚本内容并在远程执行
    info "在远程服务器上执行部署..."
    echo ""
    
    # 将必要的环境变量传递到远程
    local ENV_VARS=""
    [ -n "$SUPABASE_URL" ] && ENV_VARS="${ENV_VARS}export SUPABASE_URL='${SUPABASE_URL}'; "
    [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && ENV_VARS="${ENV_VARS}export SUPABASE_SERVICE_ROLE_KEY='${SUPABASE_SERVICE_ROLE_KEY}'; "
    [ -n "$GITHUB_REPO" ] && ENV_VARS="${ENV_VARS}export GITHUB_REPO='${GITHUB_REPO}'; "
    [ -n "$GITHUB_BRANCH" ] && ENV_VARS="${ENV_VARS}export GITHUB_BRANCH='${GITHUB_BRANCH}'; "
    
    # 在远程执行
    ssh -t ${SSH_USER}@${SSH_HOST} "${ENV_VARS} curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash"
}

# ============================================
# 主入口
# ============================================
main() {
    MODE=$(detect_mode "$1")
    
    case $MODE in
        "local")
            deploy_local
            ;;
        "remote")
            deploy_remote "$1" "$2"
            ;;
        "need_server")
            print_header
            echo "检测到在项目目录中运行，但未指定服务器。"
            echo ""
            echo "请选择部署方式："
            echo ""
            echo "  1) 部署到远程服务器"
            echo "  2) 部署到当前机器"
            echo ""
            read -p "请选择 [1-2]: " DEPLOY_TARGET
            
            if [ "$DEPLOY_TARGET" = "1" ]; then
                read -p "请输入服务器 IP: " SSH_HOST
                read -p "请输入 SSH 用户名 [root]: " SSH_USER
                SSH_USER=${SSH_USER:-root}
                deploy_remote "$SSH_HOST" "$SSH_USER"
            else
                deploy_local
            fi
            ;;
        *)
            deploy_local
            ;;
    esac
}

# 显示帮助
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "PIS 一键部署"
    echo ""
    echo "在服务器上运行:"
    echo "  curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash"
    echo ""
    echo "在本地远程部署:"
    echo "  bash scripts/deploy.sh <服务器IP> [用户名]"
    echo ""
    exit 0
fi

main "$@"
