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

# ============================================
# 语言选择
# ============================================
select_language() {
    # 检测是否为交互式终端
    if [ -t 0 ]; then
        INTERACTIVE=true
    else
        INTERACTIVE=false
    fi
    
    # 如果设置了语言环境变量，直接使用
    if [ -n "$DEPLOY_LANG" ]; then
        LANG=$DEPLOY_LANG
        return
    fi
    
    # 检测系统语言
    if [ -n "$LANG" ]; then
        if [[ "$LANG" =~ ^zh ]]; then
            LANG="zh"
        else
            LANG="en"
        fi
    else
        LANG="en"
    fi
    
    # 如果是交互式，让用户选择
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║                                                           ║${NC}"
        echo -e "${CYAN}║   📸 PIS - One-Click Deployment System                   ║${NC}"
        echo -e "${CYAN}║                                                           ║${NC}"
        echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Please select language / 请选择语言:"
        echo ""
        echo "  1) English"
        echo "  2) 中文"
        echo ""
        
        read -p "Select [1-2, default: ${LANG}]: " LANG_CHOICE
        
        case $LANG_CHOICE in
            1) LANG="en" ;;
            2) LANG="zh" ;;
            *) LANG=${LANG:-"en"} ;;
        esac
    fi
}

# 加载语言文本
load_language() {
    if [ "$LANG" = "zh" ]; then
        # 中文文本
        MSG_NON_INTERACTIVE="检测到非交互式模式，将使用环境变量或默认值"
        MSG_MODE_LOCAL="模式：在当前服务器上部署"
        MSG_SUGGEST_ROOT="建议使用 root 用户运行，或使用 sudo"
        MSG_STEP_1="第 1 步：安装环境"
        MSG_STEP_2="第 2 步：获取代码"
        MSG_STEP_3="第 3 步：选择数据库"
        MSG_STEP_4="第 4 步：选择网络模式"
        MSG_STEP_5="第 5 步：配置数据库"
        MSG_STEP_6="第 6 步：启动服务"
        MSG_STEP_7="第 7 步：验证服务"
        MSG_DOCKER_INSTALLED="Docker 已安装"
        MSG_DOCKER_INSTALLING="安装 Docker..."
        MSG_DOCKER_INSTALLED_SUCCESS="Docker 安装完成"
        MSG_COMPOSE_INSTALLED="Docker Compose 已安装"
        MSG_COMPOSE_INSTALLING="安装 Docker Compose..."
        MSG_COMPOSE_INSTALLED_SUCCESS="Docker Compose 安装完成"
        MSG_GIT_INSTALLED="Git 已安装"
        MSG_GIT_INSTALLING="安装 Git..."
        MSG_GIT_INSTALLED_SUCCESS="Git 安装完成"
        MSG_DIR_EXISTS="目录已存在"
        MSG_BACKUP_RECLONE="是否备份并重新克隆? [y/N]:"
        MSG_USE_EXISTING="使用现有代码"
        MSG_CLONE_SUCCESS="代码克隆完成"
        MSG_DB_SUPABASE="Supabase 云数据库"
        MSG_DB_SUPABASE_REC="(推荐)"
        MSG_DB_POSTGRESQL="PostgreSQL (本地 Docker)"
        MSG_DB_MYSQL="MySQL (本地 Docker)"
        MSG_SELECT_DB="请选择 [1-3，默认: 1]:"
        MSG_NET_LOCAL="内网模式 - Worker 仅本地访问"
        MSG_NET_PUBLIC="公网模式 (推荐) - Worker 可公网访问"
        MSG_SELECT_NET="请选择 [1-2，默认: 2]:"
        MSG_SUPABASE_CONFIG="请提供 Supabase 配置 (从 Dashboard → Settings → API 获取)："
        MSG_SUPABASE_URL="Supabase Project URL:"
        MSG_SUPABASE_KEY="Supabase Service Role Key:"
        MSG_USE_ENV_VAR="使用环境变量"
        MSG_NON_INTERACTIVE_REQUIRED="非交互式模式需要设置环境变量"
        MSG_ENV_CREATED="环境变量文件已创建"
        MSG_STARTING_SERVICES="启动服务..."
        MSG_BUILDING_WORKER="构建 Worker 镜像..."
        MSG_WAITING="等待服务启动..."
        MSG_SERVICE_STATUS="服务状态:"
        MSG_HEALTH_CHECK="健康检查:"
        MSG_DEPLOY_SUCCESS="🎉 部署完成！"
        MSG_MINIO_CONSOLE="MinIO Console:"
        MSG_WORKER_API="Worker API:"
        MSG_COMMON_COMMANDS="常用命令:"
        MSG_VIEW_LOGS="查看日志:"
        MSG_RESTART="重启服务:"
        MSG_UPDATE_CODE="更新代码:"
        MSG_DB_INIT="⚠️  重要：数据库架构初始化"
        MSG_DB_INIT_DESC="部署完成后，需要执行数据库架构初始化："
        MSG_DB_INIT_SUPABASE="Supabase: 在 Dashboard → SQL Editor 中执行 database/full_schema.sql"
        MSG_DB_INIT_POSTGRESQL="PostgreSQL: psql \$DATABASE_URL < database/full_schema.sql"
        MSG_DB_INIT_MYSQL="MySQL: 需要先转换为 MySQL 语法，然后执行"
        MSG_DB_INIT_NOTE="注意: full_schema.sql 仅适用于全新数据库，只需执行一次"
        MSG_TITLE="📸 PIS - 一键部署系统"
        MSG_POSTGRESQL_PASSWORD="PostgreSQL 密码:"
        MSG_MYSQL_PASSWORD="MySQL 密码:"
        MSG_CONFIG_CREATED="配置文件已创建:"
        MSG_USERNAME="用户名:"
        MSG_PASSWORD="密码:"
        MSG_LOCAL_ACCESS_ONLY="仅本地访问"
        MSG_MINIO="MinIO:"
        MSG_REDIS="Redis:"
        MSG_WORKER="Worker:"
        MSG_CHECKING_NETWORK="检测网络环境..."
        MSG_DNS_OK="DNS 解析正常"
        MSG_DNS_WARN="DNS 解析可能有问题，将使用 --network=host 模式"
        MSG_CONFIG_DOCKER_DNS="配置 Docker DNS..."
        MSG_RESTART_DOCKER="重启 Docker 以应用 DNS 配置..."
        MSG_BUILD_STRATEGY_1="策略 1: 使用 --network=host 模式构建..."
        MSG_BUILD_STRATEGY_2="策略 2: 使用 docker-compose build..."
        MSG_BUILD_STRATEGY_3="策略 3: 检查是否有预构建镜像可用..."
        MSG_BUILD_SUCCESS_HOST="构建成功（使用 --network=host）"
        MSG_BUILD_SUCCESS_COMPOSE="构建成功（使用 docker-compose）"
        MSG_BUILD_SUCCESS_PREBUILT="使用预构建镜像"
        MSG_BUILD_FAILED="所有构建策略都失败了"
        MSG_BUILD_FAILED_REASONS="可能的原因："
        MSG_BUILD_FAILED_REASON_1="  1. 网络连接问题（DNS 解析失败）"
        MSG_BUILD_FAILED_REASON_2="  2. 防火墙阻止了连接"
        MSG_BUILD_FAILED_REASON_3="  3. 镜像源不可用"
        MSG_BUILD_SOLUTIONS="解决方案："
        MSG_BUILD_SOLUTION_1="  1. 检查网络连接: ping 8.8.8.8"
        MSG_BUILD_SOLUTION_2="  2. 检查 DNS 配置: cat /etc/resolv.conf"
        MSG_BUILD_SOLUTION_3="  3. 手动构建: cd /opt/pis && docker build --network=host -f docker/worker.Dockerfile -t pis-worker:latest ."
        MSG_SKIP_BUILD="是否跳过 Worker 构建，仅启动其他服务? [y/N]:"
        MSG_SKIP_BUILD_WARN="跳过 Worker 构建，将使用 docker-compose.yml 中的 build 配置"
        MSG_BUILD_FAILED_EXIT="Worker 构建失败，无法继续部署"
        MSG_BUILD_LOG_SAVED="构建日志已保存到:"
        MSG_BUILD_MANUAL="请尝试："
        MSG_BUILD_MANUAL_1="  1. 检查网络连接和 DNS 配置"
        MSG_BUILD_MANUAL_2="  2. 手动构建: cd /opt/pis && docker build --network=host -f docker/worker.Dockerfile -t pis-worker:latest ."
        MSG_BUILD_MANUAL_3="  3. 或使用预构建镜像: docker pull junyuzhan/pis-worker:latest"
        MSG_UPDATED_COMPOSE="已更新 docker-compose.yml 使用预构建镜像"
    else
        # English text
        MSG_NON_INTERACTIVE="Non-interactive mode detected, using environment variables or defaults"
        MSG_MODE_LOCAL="Mode: Deploy on current server"
        MSG_SUGGEST_ROOT="Recommend running as root or using sudo"
        MSG_STEP_1="Step 1: Install environment"
        MSG_STEP_2="Step 2: Get code"
        MSG_STEP_3="Step 3: Select database"
        MSG_STEP_4="Step 4: Select network mode"
        MSG_STEP_5="Step 5: Configure database"
        MSG_STEP_6="Step 6: Start services"
        MSG_STEP_7="Step 7: Verify services"
        MSG_DOCKER_INSTALLED="Docker installed"
        MSG_DOCKER_INSTALLING="Installing Docker..."
        MSG_DOCKER_INSTALLED_SUCCESS="Docker installation completed"
        MSG_COMPOSE_INSTALLED="Docker Compose installed"
        MSG_COMPOSE_INSTALLING="Installing Docker Compose..."
        MSG_COMPOSE_INSTALLED_SUCCESS="Docker Compose installation completed"
        MSG_GIT_INSTALLED="Git installed"
        MSG_GIT_INSTALLING="Installing Git..."
        MSG_GIT_INSTALLED_SUCCESS="Git installation completed"
        MSG_DIR_EXISTS="Directory already exists"
        MSG_BACKUP_RECLONE="Backup and re-clone? [y/N]:"
        MSG_USE_EXISTING="Using existing code"
        MSG_CLONE_SUCCESS="Code cloned successfully"
        MSG_DB_SUPABASE="Supabase Cloud Database"
        MSG_DB_SUPABASE_REC="(Recommended)"
        MSG_DB_POSTGRESQL="PostgreSQL (Local Docker)"
        MSG_DB_MYSQL="MySQL (Local Docker)"
        MSG_SELECT_DB="Select [1-3, default: 1]:"
        MSG_NET_LOCAL="Internal mode - Worker local access only"
        MSG_NET_PUBLIC="Public mode (Recommended) - Worker public access"
        MSG_SELECT_NET="Select [1-2, default: 2]:"
        MSG_SUPABASE_CONFIG="Please provide Supabase configuration (from Dashboard → Settings → API):"
        MSG_SUPABASE_URL="Supabase Project URL:"
        MSG_SUPABASE_KEY="Supabase Service Role Key:"
        MSG_USE_ENV_VAR="Using environment variable"
        MSG_NON_INTERACTIVE_REQUIRED="Non-interactive mode requires environment variables"
        MSG_ENV_CREATED="Environment file created"
        MSG_STARTING_SERVICES="Starting services..."
        MSG_BUILDING_WORKER="Building Worker image..."
        MSG_WAITING="Waiting for services to start..."
        MSG_SERVICE_STATUS="Service status:"
        MSG_HEALTH_CHECK="Health check:"
        MSG_DEPLOY_SUCCESS="🎉 Deployment completed!"
        MSG_MINIO_CONSOLE="MinIO Console:"
        MSG_WORKER_API="Worker API:"
        MSG_COMMON_COMMANDS="Common commands:"
        MSG_VIEW_LOGS="View logs:"
        MSG_RESTART="Restart services:"
        MSG_UPDATE_CODE="Update code:"
        MSG_DB_INIT="⚠️  Important: Database Schema Initialization"
        MSG_DB_INIT_DESC="After deployment, you need to initialize the database schema:"
        MSG_DB_INIT_SUPABASE="Supabase: Execute database/full_schema.sql in Dashboard → SQL Editor"
        MSG_DB_INIT_POSTGRESQL="PostgreSQL: psql \$DATABASE_URL < database/full_schema.sql"
        MSG_DB_INIT_MYSQL="MySQL: Convert to MySQL syntax first, then execute"
        MSG_DB_INIT_NOTE="Note: full_schema.sql is for new databases only, execute once"
        MSG_TITLE="📸 PIS - One-Click Deployment System"
        MSG_POSTGRESQL_PASSWORD="PostgreSQL password:"
        MSG_MYSQL_PASSWORD="MySQL password:"
        MSG_CONFIG_CREATED="Configuration file created:"
        MSG_USERNAME="Username:"
        MSG_PASSWORD="Password:"
        MSG_LOCAL_ACCESS_ONLY="Local access only"
        MSG_MINIO="MinIO:"
        MSG_REDIS="Redis:"
        MSG_WORKER="Worker:"
        MSG_CHECKING_NETWORK="Checking network environment..."
        MSG_DNS_OK="DNS resolution OK"
        MSG_DNS_WARN="DNS resolution may have issues, will use --network=host mode"
        MSG_CONFIG_DOCKER_DNS="Configuring Docker DNS..."
        MSG_RESTART_DOCKER="Restarting Docker to apply DNS configuration..."
        MSG_BUILD_STRATEGY_1="Strategy 1: Building with --network=host mode..."
        MSG_BUILD_STRATEGY_2="Strategy 2: Using docker-compose build..."
        MSG_BUILD_STRATEGY_3="Strategy 3: Checking for pre-built images..."
        MSG_BUILD_SUCCESS_HOST="Build successful (using --network=host)"
        MSG_BUILD_SUCCESS_COMPOSE="Build successful (using docker-compose)"
        MSG_BUILD_SUCCESS_PREBUILT="Using pre-built image"
        MSG_BUILD_FAILED="All build strategies failed"
        MSG_BUILD_FAILED_REASONS="Possible reasons:"
        MSG_BUILD_FAILED_REASON_1="  1. Network connection issues (DNS resolution failed)"
        MSG_BUILD_FAILED_REASON_2="  2. Firewall blocking connections"
        MSG_BUILD_FAILED_REASON_3="  3. Mirror sources unavailable"
        MSG_BUILD_SOLUTIONS="Solutions:"
        MSG_BUILD_SOLUTION_1="  1. Check network: ping 8.8.8.8"
        MSG_BUILD_SOLUTION_2="  2. Check DNS: cat /etc/resolv.conf"
        MSG_BUILD_SOLUTION_3="  3. Manual build: cd /opt/pis && docker build --network=host -f docker/worker.Dockerfile -t pis-worker:latest ."
        MSG_SKIP_BUILD="Skip Worker build and start other services only? [y/N]:"
        MSG_SKIP_BUILD_WARN="Skipping Worker build, will use build config in docker-compose.yml"
        MSG_BUILD_FAILED_EXIT="Worker build failed, cannot continue deployment"
        MSG_BUILD_LOG_SAVED="Build log saved to:"
        MSG_BUILD_MANUAL="Please try:"
        MSG_BUILD_MANUAL_1="  1. Check network connection and DNS configuration"
        MSG_BUILD_MANUAL_2="  2. Manual build: cd /opt/pis && docker build --network=host -f docker/worker.Dockerfile -t pis-worker:latest ."
        MSG_BUILD_MANUAL_3="  3. Or use pre-built image: docker pull junyuzhan/pis-worker:latest"
        MSG_UPDATED_COMPOSE="Updated docker-compose.yml to use pre-built image"
    fi
    
    if [ "$INTERACTIVE" = false ]; then
        warn "$MSG_NON_INTERACTIVE"
    fi
}

# 初始化语言
select_language
load_language

# 配置
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pis}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/junyuzhan/pis.git}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

# 打印标题
print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ${MSG_TITLE}                                    ║"
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
    echo -e "${BOLD}${MSG_MODE_LOCAL}${NC}"
    echo ""
    
    # 检查是否是 root
    if [ "$EUID" -ne 0 ]; then
        warn "$MSG_SUGGEST_ROOT"
    fi
    
    # ===== 安装 Docker =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_1}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if command -v docker &> /dev/null; then
        success "${MSG_DOCKER_INSTALLED}: $(docker --version)"
    else
        info "$MSG_DOCKER_INSTALLING"
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        success "$MSG_DOCKER_INSTALLED_SUCCESS"
    fi
    
    # 检测并设置 Docker Compose 命令
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        success "$MSG_COMPOSE_INSTALLED"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        success "$MSG_COMPOSE_INSTALLED"
    else
        info "$MSG_COMPOSE_INSTALLING"
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        COMPOSE_CMD="docker-compose"
        success "$MSG_COMPOSE_INSTALLED_SUCCESS"
    fi
    
    if command -v git &> /dev/null; then
        success "$MSG_GIT_INSTALLED"
    else
        info "$MSG_GIT_INSTALLING"
        if command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y git
        elif command -v yum &> /dev/null; then
            yum install -y git
        fi
        success "$MSG_GIT_INSTALLED_SUCCESS"
    fi
    
    # ===== 克隆代码 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_2}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -d "${DEPLOY_DIR}" ]; then
        warn "${MSG_DIR_EXISTS}: ${DEPLOY_DIR}"
        if [ "$INTERACTIVE" = true ]; then
            read -p "$MSG_BACKUP_RECLONE " RECLONE
        else
            RECLONE="N"  # 非交互式默认不重新克隆
        fi
        if [[ "$RECLONE" =~ ^[Yy]$ ]]; then
            mv ${DEPLOY_DIR} ${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)
            git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${DEPLOY_DIR}
            success "$MSG_CLONE_SUCCESS"
        else
            info "$MSG_USE_EXISTING"
            cd ${DEPLOY_DIR} && git pull || true
        fi
    else
        git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${DEPLOY_DIR}
        success "$MSG_CLONE_SUCCESS"
    fi
    
    cd ${DEPLOY_DIR}
    
    # ===== 选择数据库 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_3}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1) ${MSG_DB_SUPABASE} ${GREEN}${MSG_DB_SUPABASE_REC}${NC}"
    echo "  2) ${MSG_DB_POSTGRESQL}"
    echo "  3) ${MSG_DB_MYSQL}"
    echo ""
    
    if [ "$INTERACTIVE" = true ]; then
        read -p "$MSG_SELECT_DB " DB_CHOICE
    else
        DB_CHOICE=${DATABASE_TYPE:-1}
        [ "$DB_CHOICE" = "supabase" ] && DB_CHOICE=1
        [ "$DB_CHOICE" = "postgresql" ] && DB_CHOICE=2
        [ "$DB_CHOICE" = "mysql" ] && DB_CHOICE=3
        echo "Using environment variable or default: $DB_CHOICE"
    fi
    DB_CHOICE=${DB_CHOICE:-1}
    
    # ===== 选择网络模式 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_4}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1) ${MSG_NET_LOCAL}"
    echo "  2) ${MSG_NET_PUBLIC}"
    echo ""
    
    if [ "$INTERACTIVE" = true ]; then
        read -p "$MSG_SELECT_NET " NET_CHOICE
    else
        NET_CHOICE=${NETWORK_MODE:-2}
        [ "$NET_CHOICE" = "local" ] && NET_CHOICE=1
        [ "$NET_CHOICE" = "public" ] && NET_CHOICE=2
        echo "Using environment variable or default: $NET_CHOICE"
    fi
    NET_CHOICE=${NET_CHOICE:-2}
    
    WORKER_BIND="127.0.0.1"
    [ "$NET_CHOICE" = "2" ] && WORKER_BIND="0.0.0.0"
    
    # ===== 配置数据库 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_5}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 生成 MinIO 密钥
    MINIO_ACCESS_KEY=$(generate_password 8)
    MINIO_SECRET_KEY=$(generate_password 16)
    
    case $DB_CHOICE in
        1)
            # Supabase
            echo ""
            echo "$MSG_SUPABASE_CONFIG"
            echo ""
            
            if [ -n "$SUPABASE_URL" ]; then
                info "$MSG_USE_ENV_VAR SUPABASE_URL"
            elif [ "$INTERACTIVE" = true ]; then
                read -p "$MSG_SUPABASE_URL " SUPABASE_URL
            else
                error "$MSG_NON_INTERACTIVE_REQUIRED SUPABASE_URL"
                exit 1
            fi
            
            if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
                info "$MSG_USE_ENV_VAR SUPABASE_SERVICE_ROLE_KEY"
            elif [ "$INTERACTIVE" = true ]; then
                read -p "$MSG_SUPABASE_KEY " SUPABASE_SERVICE_ROLE_KEY
            else
                error "$MSG_NON_INTERACTIVE_REQUIRED SUPABASE_SERVICE_ROLE_KEY"
                exit 1
            fi
            
            if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
                error "Supabase configuration cannot be empty"
                exit 1
            fi
            
            # 创建 .env
            cat > ${DEPLOY_DIR}/.env << EOF
# PIS 配置 - Supabase
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# ==================== 数据库配置 ====================
DATABASE_TYPE=supabase

# ==================== Supabase 数据库 ====================
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# ==================== 存储配置 ====================
STORAGE_TYPE=minio

# ==================== MinIO 存储配置 ====================
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos
# 兼容新配置格式
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=${MINIO_ACCESS_KEY}
STORAGE_SECRET_KEY=${MINIO_SECRET_KEY}
STORAGE_BUCKET=pis-photos

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== Worker 服务 ====================
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

# ==================== 存储配置 ====================
STORAGE_TYPE=minio

# ==================== MinIO 存储配置 ====================
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos
# 兼容新配置格式
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=${MINIO_ACCESS_KEY}
STORAGE_SECRET_KEY=${MINIO_SECRET_KEY}
STORAGE_BUCKET=pis-photos

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== Worker 服务 ====================
HTTP_PORT=3001
WORKER_BIND_HOST=${WORKER_BIND}
EOF
            
            cp docker/docker-compose.postgresql.yml docker/docker-compose.yml.active
            info "${MSG_POSTGRESQL_PASSWORD} ${DB_PASSWORD}"
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

# ==================== 存储配置 ====================
STORAGE_TYPE=minio

# ==================== MinIO 存储配置 ====================
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos
# 兼容新配置格式
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=${MINIO_ACCESS_KEY}
STORAGE_SECRET_KEY=${MINIO_SECRET_KEY}
STORAGE_BUCKET=pis-photos

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== Worker 服务 ====================
HTTP_PORT=3001
WORKER_BIND_HOST=${WORKER_BIND}
EOF
            
            cp docker/docker-compose.mysql.yml docker/docker-compose.yml.active
            info "${MSG_MYSQL_PASSWORD} ${DB_PASSWORD}"
            ;;
    esac
    
    success "${MSG_CONFIG_CREATED} ${DEPLOY_DIR}/.env"
    
    # ===== 启动服务 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_6}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd ${DEPLOY_DIR}/docker
    
    # 注意：docker-compose.yml 使用 ../.env（根目录的 .env 文件）
    # 不需要复制 .env 到 docker 目录，保持统一配置在根目录
    
    # 使用对应的 docker-compose 文件
    if [ -f "docker-compose.yml.active" ]; then
        cp docker-compose.yml.active docker-compose.yml
    fi
    
    $COMPOSE_CMD down 2>/dev/null || true
    
    info "$MSG_BUILDING_WORKER"
    
    # ===== 网络环境检测 =====
    info "$MSG_CHECKING_NETWORK"
    NETWORK_OK=false
    DNS_OK=false
    
    # 测试 DNS 解析（多种方式）
    if (timeout 3 bash -c "echo > /dev/tcp/dl-cdn.alpinelinux.org/443" 2>/dev/null) || \
       (timeout 3 bash -c "echo > /dev/tcp/mirrors.aliyun.com/443" 2>/dev/null) || \
       (timeout 3 curl -s --connect-timeout 3 https://dl-cdn.alpinelinux.org >/dev/null 2>&1) || \
       (ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1); then
        DNS_OK=true
        success "$MSG_DNS_OK"
    else
        warn "$MSG_DNS_WARN"
    fi
    
    # 配置 Docker DNS（如果需要）
    DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
    if [ "$DNS_OK" = false ] && ([ ! -f "$DOCKER_DAEMON_JSON" ] || ! grep -q '"dns"' "$DOCKER_DAEMON_JSON" 2>/dev/null); then
        info "$MSG_CONFIG_DOCKER_DNS"
        [ -f "$DOCKER_DAEMON_JSON" ] && cp "$DOCKER_DAEMON_JSON" "${DOCKER_DAEMON_JSON}.bak" 2>/dev/null || true
        
        python3 -c "
import json
try:
    with open('$DOCKER_DAEMON_JSON', 'r') as f:
        config = json.load(f)
except:
    config = {}
config['dns'] = ['8.8.8.8', '8.8.4.4', '114.114.114.114', '1.1.1.1']
with open('$DOCKER_DAEMON_JSON', 'w') as f:
    json.dump(config, f, indent=2)
" 2>/dev/null || echo '{"dns": ["8.8.8.8", "8.8.4.4", "114.114.114.114", "1.1.1.1"]}' > "$DOCKER_DAEMON_JSON"
        
        if systemctl is-active docker >/dev/null 2>&1; then
            warn "$MSG_RESTART_DOCKER"
            systemctl restart docker 2>/dev/null || true
            sleep 3
        fi
    fi
    
    # ===== 构建 Worker 镜像（多种策略，适应所有环境） =====
    BUILD_SUCCESS=false
    cd ${DEPLOY_DIR}
    
    # 策略 1: 使用 --network=host（推荐，绕过 DNS 问题，适应所有网络环境）
    info "$MSG_BUILD_STRATEGY_1"
    if DOCKER_BUILDKIT=1 docker build \
        --network=host \
        -f docker/worker.Dockerfile \
        -t pis-worker:latest \
        . 2>&1 | tee /tmp/docker-build.log; then
        BUILD_SUCCESS=true
        success "$MSG_BUILD_SUCCESS_HOST"
    else
        warn "策略 1 失败，尝试策略 2..."
        
        # 策略 2: 使用 docker-compose build（如果网络正常）
        if [ "$DNS_OK" = true ]; then
            info "$MSG_BUILD_STRATEGY_2"
            cd ${DEPLOY_DIR}/docker
            if $COMPOSE_CMD build worker 2>&1 | tee -a /tmp/docker-build.log; then
                BUILD_SUCCESS=true
                success "$MSG_BUILD_SUCCESS_COMPOSE"
                # docker-compose 构建后不需要更新配置
            fi
        fi
        
        # 策略 3: 尝试使用预构建镜像（如果可用）
        if [ "$BUILD_SUCCESS" = false ]; then
            warn "$MSG_BUILD_STRATEGY_3"
            if docker pull junyuzhan/pis-worker:latest 2>/dev/null; then
                docker tag junyuzhan/pis-worker:latest pis-worker:latest
                BUILD_SUCCESS=true
                success "$MSG_BUILD_SUCCESS_PREBUILT"
            fi
        fi
        
        # 策略 4: 询问用户是否跳过构建（交互式模式）
        if [ "$BUILD_SUCCESS" = false ] && [ "$INTERACTIVE" = true ]; then
            echo ""
            warn "$MSG_BUILD_FAILED"
            echo ""
            echo "$MSG_BUILD_FAILED_REASONS"
            echo "$MSG_BUILD_FAILED_REASON_1"
            echo "$MSG_BUILD_FAILED_REASON_2"
            echo "$MSG_BUILD_FAILED_REASON_3"
            echo ""
            echo "$MSG_BUILD_SOLUTIONS"
            echo "$MSG_BUILD_SOLUTION_1"
            echo "$MSG_BUILD_SOLUTION_2"
            echo "$MSG_BUILD_SOLUTION_3"
            echo ""
            read -p "$MSG_SKIP_BUILD " SKIP_BUILD
            if [[ "$SKIP_BUILD" =~ ^[Yy]$ ]]; then
                warn "$MSG_SKIP_BUILD_WARN"
                BUILD_SUCCESS=true  # 标记为成功，让 docker-compose 自己处理
            fi
        fi
    fi
    
    # 如果构建成功，更新 docker-compose.yml 使用预构建镜像
    if [ "$BUILD_SUCCESS" = true ] && [ -f "${DEPLOY_DIR}/docker/docker-compose.yml" ]; then
        cd ${DEPLOY_DIR}/docker
        if grep -q "build:" docker-compose.yml && ! docker images | grep -q "pis-worker"; then
            # 如果构建成功但镜像不存在，说明是 docker-compose build，不需要更新
            :
        elif grep -q "build:" docker-compose.yml && docker images | grep -q "pis-worker"; then
            # 使用预构建镜像
            cp docker-compose.yml docker-compose.yml.build.bak
            
            python3 << 'PYEOF' 2>/dev/null || {
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# 替换 build 块为 image
pattern = r'(\s+)build:\s*\n\s+context:.*?\n\s+dockerfile:.*?\n'
replacement = r'\1image: pis-worker:latest\n'
content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

with open('docker-compose.yml', 'w') as f:
    f.write(content)
PYEOF
            # Python 失败，使用 sed
            sed -i '/build:/,/dockerfile:/d' docker-compose.yml 2>/dev/null || true
            sed -i '/worker:/a\    image: pis-worker:latest' docker-compose.yml 2>/dev/null || true
            }
            
            success "$MSG_UPDATED_COMPOSE"
        fi
    fi
    
    # 如果构建失败且用户没有选择跳过，退出
    if [ "$BUILD_SUCCESS" = false ]; then
        error "$MSG_BUILD_FAILED_EXIT"
        echo ""
        echo "$MSG_BUILD_LOG_SAVED /tmp/docker-build.log"
        echo ""
        echo "$MSG_BUILD_MANUAL"
        echo "$MSG_BUILD_MANUAL_1"
        echo "$MSG_BUILD_MANUAL_2"
        echo "$MSG_BUILD_MANUAL_3"
        exit 1
    fi
    
    # 确保在 docker 目录执行 docker-compose 命令
    cd ${DEPLOY_DIR}/docker
    
    info "$MSG_STARTING_SERVICES"
    $COMPOSE_CMD up -d
    
    echo ""
    info "$MSG_WAITING"
    sleep 10
    
    # ===== 验证服务 =====
    echo ""
    echo -e "${BOLD}${MSG_STEP_7}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo ""
    $COMPOSE_CMD ps
    echo ""
    
    echo "$MSG_HEALTH_CHECK"
    echo -n "  ${MSG_MINIO} "
    curl -s http://localhost:19000/minio/health/live && echo " ✓" || echo " ✗"
    
    echo -n "  ${MSG_REDIS} "
    docker exec pis-redis redis-cli ping 2>/dev/null && echo " ✓" || echo " ✗"
    
    echo -n "  ${MSG_WORKER} "
    curl -s http://localhost:3001/health && echo " ✓" || echo " ✗"
    
    # ===== 完成 =====
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}${BOLD}${MSG_DEPLOY_SUCCESS}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📦 ${MSG_MINIO_CONSOLE} http://$(hostname -I | awk '{print $1}'):19001"
    echo "   ${MSG_USERNAME} ${MINIO_ACCESS_KEY}"
    echo "   ${MSG_PASSWORD} ${MINIO_SECRET_KEY}"
    echo ""
    
    if [ "$WORKER_BIND" = "0.0.0.0" ]; then
        echo "🔧 ${MSG_WORKER_API} http://$(hostname -I | awk '{print $1}'):3001"
    else
        echo "🔧 ${MSG_WORKER_API} http://127.0.0.1:3001 (${MSG_LOCAL_ACCESS_ONLY})"
    fi
    echo ""
    
    echo "📝 ${MSG_COMMON_COMMANDS}"
    echo "   ${MSG_VIEW_LOGS} cd ${DEPLOY_DIR}/docker && $COMPOSE_CMD logs -f"
    echo "   ${MSG_RESTART} cd ${DEPLOY_DIR}/docker && $COMPOSE_CMD restart"
    echo ""
    
    # 数据库架构初始化提示
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}${BOLD}${MSG_DB_INIT}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "${MSG_DB_INIT_DESC}"
    echo ""
    case $DB_CHOICE in
        1)
            echo "  📋 ${MSG_DB_INIT_SUPABASE}"
            ;;
        2)
            echo "  📋 ${MSG_DB_INIT_POSTGRESQL}"
            ;;
        3)
            echo "  📋 ${MSG_DB_INIT_MYSQL}"
            ;;
    esac
    echo ""
    echo "  ${MSG_DB_INIT_NOTE}"
    echo ""
    echo "  架构文件位置: ${DEPLOY_DIR}/database/full_schema.sql"
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
