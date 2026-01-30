#!/bin/bash
# ============================================
# PIS 一键部署脚本
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 脚本所在目录 (docker/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Docker 目录
DOCKER_DIR="$SCRIPT_DIR"

cd "$SCRIPT_DIR"

# 打印带颜色的标题
print_title() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# 打印步骤
print_step() {
    echo ""
    echo -e "${BLUE}[$1] $2${NC}"
}

# 打印成功
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 打印错误
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 打印警告
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 获取用户输入
get_input() {
    local prompt="$1"
    local default="$2"
    local result

    if [ -n "$default" ]; then
        read -p "$(echo -e ${GREEN}${prompt}${NC} [$default]): " result
        echo "${result:-$default}"
    else
        read -p "$(echo -e ${GREEN}${prompt}${NC}): " result
        echo "$result"
    fi
}

# 获取确认
get_confirm() {
    local prompt="$1"
    local default="${2:-n}"

    while true; do
        local result
        read -p "$(echo -e ${GREEN}${prompt}${NC} [y/n]: ") result
        result=$(echo "$result" | tr '[:upper:]' '[:lower:]')

        if [ -z "$result" ]; then
            result="$default"
        fi

        if [ "$result" = "y" ] || [ "$result" = "yes" ]; then
            return 0
        elif [ "$result" = "n" ] || [ "$result" = "no" ]; then
            return 1
        fi
    done
}

# 生成随机密钥
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# 检查 Docker
check_docker() {
    print_step "1/9" "检查 Docker 环境"

    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        echo "请先安装 Docker: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    print_success "Docker 已安装: $(docker --version)"

    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装"
        echo "请先安装 Docker Compose"
        exit 1
    fi

    if docker compose version &> /dev/null; then
        print_success "Docker Compose 已安装 (compose 插件)"
        COMPOSE_CMD="docker compose"
    else
        print_success "Docker Compose 已安装 (standalone)"
        COMPOSE_CMD="docker-compose"
    fi
}

# 选择部署方式
choose_deployment_mode() {
    print_step "2/9" "选择部署方式"

    echo ""
    echo -e "${BOLD}请选择部署方式：${NC}"
    echo ""
    echo -e "  ${CYAN}1.${NC} ${GREEN}混合部署${NC} (推荐新手)"
    echo "     - 前端: Vercel (自动部署)"
    echo "     - 数据库: Supabase Cloud"
    echo "     - 存储/Worker: 你的服务器"
    echo "     - 优点: 配置简单，快速上线"
    echo "     - 缺点: 依赖第三方服务"
    echo ""
    echo -e "  ${CYAN}2.${NC} ${YELLOW}半自托管${NC} (推荐中级)"
    echo "     - 数据库: 本地 PostgreSQL"
    echo "     - 认证: Supabase Auth (免费)"
    echo "     - 存储/Worker: 你的服务器"
    echo "     - 优点: 数据自控，认证省心"
    echo "     - 缺点: 需要注册 Supabase"
    echo ""
    echo -e "  ${CYAN}3.${NC} ${BLUE}完全自托管${NC} (推荐进阶)"
    echo "     - 所有服务: 你的服务器"
    echo "     - 认证: 自定义 JWT 认证"
    echo "     - 优点: 数据完全自控，无第三方依赖"
    echo "     - 缺点: 需要手动创建管理员"
    echo ""

    while true; do
        local choice
        read -p "$(echo -e ${GREEN}请选择 [1/2/3]${NC}: ")" choice

        case "$choice" in
            1)
                DEPLOYMENT_MODE="hybrid"
                AUTH_MODE="supabase"
                print_success "选择: 混合部署"
                return
                ;;
            2)
                DEPLOYMENT_MODE="standalone"
                AUTH_MODE="supabase"
                print_success "选择: 半自托管"
                return
                ;;
            3)
                DEPLOYMENT_MODE="standalone"
                AUTH_MODE="custom"
                print_success "选择: 完全自托管"
                return
                ;;
            *)
                print_error "无效选择，请输入 1、2 或 3"
                ;;
        esac
    done
}

# 获取域名配置
configure_domain() {
    print_step "3/9" "配置域名"

    echo ""
    echo -e "${YELLOW}请输入你的域名（不带 http:// 或 https://）${NC}"
    echo -e "${YELLOW}如果还没有域名，可以输入 localhost 进行本地测试${NC}"
    echo ""

    DOMAIN=$(get_input "域名" "")

    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        DOMAIN="localhost"
        print_warning "使用 localhost，仅适用于本地测试"
    else
        print_success "域名: $DOMAIN"
    fi

    # 自动推断相关 URL
    APP_URL="https://$DOMAIN"
    MEDIA_URL="https://$DOMAIN/media"
    WORKER_URL="https://$DOMAIN/worker-api"

    if [ "$DOMAIN" = "localhost" ]; then
        APP_URL="http://localhost:3000"
        MEDIA_URL="http://localhost:9000/pis-photos"
        WORKER_URL="http://localhost:3001"
    fi
}

# 配置 Supabase（混合部署）
configure_supabase() {
    print_step "4a/9" "配置 Supabase"

    echo ""
    echo -e "${CYAN}请按照以下步骤配置 Supabase:${NC}"
    echo ""
    echo "  1. 访问 https://supabase.com 并登录"
    echo "  2. 点击 New Project 创建项目"
    echo "  3. 创建完成后，进入 Settings → API"
    echo ""

    SUPABASE_URL=$(get_input "Project URL" "")
    SUPABASE_ANON_KEY=$(get_input "anon public key" "")
    SUPABASE_SERVICE_KEY=$(get_input "service_role key" "")

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        print_error "Supabase 配置不完整"
        exit 1
    fi

    print_success "Supabase 已配置"

    echo ""
    echo -e "${YELLOW}接下来请在 Supabase 中创建管理员账号:${NC}"
    echo "  1. 进入 Authentication → Users"
    echo "  2. 点击 Add user → Create new user"
    echo "  3. 输入管理员邮箱和密码"
    echo "  4. ✅ 勾选 Auto Confirm User"
    echo "  5. 点击 Create user"
    echo ""
    get_confirm "已创建管理员账号，继续" "y"
}

# 配置 PostgreSQL（自托管）
configure_postgres() {
    print_step "4b/9" "配置 PostgreSQL"

    echo ""
    echo -e "${CYAN}PostgreSQL 将运行在 Docker 容器中${NC}"
    echo ""

    POSTGRES_PASSWORD=$(get_input "数据库密码 (留空自动生成)" "")
    if [ -z "$POSTGRES_PASSWORD" ]; then
        POSTGRES_PASSWORD=$(generate_secret)
        print_success "已生成数据库密码"
    fi

    POSTGRES_DB="pis"
    POSTGRES_USER="pis"

    print_success "PostgreSQL 已配置"

    # 根据认证模式配置
    if [ "$AUTH_MODE" = "supabase" ]; then
        # 半自托管模式：需要 Supabase Auth
        echo ""
        echo -e "${YELLOW}========================================${NC}"
        echo -e "${YELLOW}  前端认证需要 Supabase（免费）${NC}"
        echo -e "${YELLOW}========================================${NC}"
        echo ""
        echo -e "${CYAN}请按照以下步骤配置 Supabase:${NC}"
        echo ""
        echo "  1. 访问 https://supabase.com 并登录"
        echo "  2. 点击 New Project 创建项目"
        echo "  3. 创建完成后，进入 Settings → API"
        echo ""

        SUPABASE_URL=$(get_input "Project URL (如 https://xxx.supabase.co)" "")
        SUPABASE_ANON_KEY=$(get_input "anon public key" "")
        SUPABASE_SERVICE_KEY=$(get_input "service_role key" "")

        if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
            print_warning "Supabase 配置不完整，前端将无法登录"
            print_warning "请稍后编辑 .env 文件添加 Supabase 配置"
        else
            print_success "Supabase 已配置"
        fi

        echo ""
        echo -e "${YELLOW}接下来请在 Supabase 中创建管理员账号:${NC}"
        echo "  1. 进入 Authentication → Users"
        echo "  2. 点击 Add user → Create new user"
        echo "  3. 输入管理员邮箱和密码"
        echo "  4. ✅ 勾选 Auto Confirm User"
        echo "  5. 点击 Create user"
        echo ""
        get_confirm "已创建管理员账号（或稍后创建），继续" "y"
    else
        # 完全自托管模式：自定义认证
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  完全自托管模式（无需 Supabase）${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${CYAN}请配置管理员账号:${NC}"
        echo ""

        ADMIN_EMAIL=$(get_input "管理员邮箱" "admin@example.com")
        ADMIN_PASSWORD=$(get_input "管理员密码 (留空自动生成)" "")
        if [ -z "$ADMIN_PASSWORD" ]; then
            ADMIN_PASSWORD=$(generate_short_secret)
            echo -e "${GREEN}已生成管理员密码: ${BOLD}$ADMIN_PASSWORD${NC}"
            echo -e "${RED}⚠️  请务必记录此密码！${NC}"
        fi

        print_success "管理员账号已配置"
        
        # 清空 Supabase 变量
        SUPABASE_URL=""
        SUPABASE_ANON_KEY=""
        SUPABASE_SERVICE_KEY=""
    fi
}

# 生成短密码（用于管理员初始密码）
generate_short_secret() {
    openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12
}

# 配置 MinIO
configure_minio() {
    print_step "5/9" "配置 MinIO 对象存储"

    echo ""
    echo -e "${CYAN}MinIO 将用于存储照片文件${NC}"
    echo ""

    MINIO_ACCESS_KEY=$(get_input "MinIO 访问密钥 (留空自动生成)" "")
    if [ -z "$MINIO_ACCESS_KEY" ]; then
        MINIO_ACCESS_KEY=$(generate_secret | cut -c1-16)
        print_success "已生成 MinIO 访问密钥"
    fi

    MINIO_SECRET_KEY=$(get_input "MinIO 密钥 (留空自动生成)" "")
    if [ -z "$MINIO_SECRET_KEY" ]; then
        MINIO_SECRET_KEY=$(generate_secret)
        print_success "已生成 MinIO 密钥"
    fi

    MINIO_BUCKET="pis-photos"

    print_success "MinIO 已配置"
}

# 配置 Worker
configure_worker() {
    print_step "6/9" "配置 Worker API"

    WORKER_API_KEY=$(get_input "Worker API 密钥 (留空自动生成)" "")
    if [ -z "$WORKER_API_KEY" ]; then
        WORKER_API_KEY=$(generate_secret)
        print_success "已生成 Worker API 密钥"
    fi

    print_success "Worker API 已配置"
}

# 配置安全密钥
configure_security() {
    print_step "7/9" "配置安全密钥"

    ALBUM_SESSION_SECRET=$(get_input "相册会话密钥 (留空自动生成)" "")
    if [ -z "$ALBUM_SESSION_SECRET" ]; then
        ALBUM_SESSION_SECRET=$(generate_secret)
        print_success "已生成会话密钥"
    fi

    print_success "安全密钥已配置"
}

# 配置告警（可选）
configure_alerts() {
    print_step "8/9" "配置告警服务（可选）"

    echo ""
    echo -e "${YELLOW}是否需要配置告警通知？${NC}"
    echo "  - 支持使用 Telegram Bot 或 邮件通知"
    echo "  - 不配置则仅记录到控制台日志"
    echo ""

    if get_confirm "配置告警" "n"; then
        echo ""
        echo -e "${CYAN}请选择告警方式:${NC}"
        echo "  1. Telegram（推荐）"
        echo "  2. 邮件"
        echo "  3. 仅日志"
        echo ""

        while true; do
            local alert_choice
            read -p "$(echo -e "${GREEN}请选择 [1/2/3]${NC}: ")" alert_choice

            case "$alert_choice" in
                1)
                    ALERT_TYPE="telegram"
                    TELEGRAM_BOT_TOKEN=$(get_input "Telegram Bot Token" "")
                    TELEGRAM_CHAT_ID=$(get_input "Telegram Chat ID" "")
                    print_success "Telegram 告警已配置"
                    break
                    ;;
                2)
                    ALERT_TYPE="email"
                    ALERT_SMTP_HOST=$(get_input "SMTP 服务器 (如 smtp.gmail.com)" "")
                    ALERT_SMTP_PORT=$(get_input "SMTP 端口 (如 587)" "587")
                    ALERT_SMTP_USER=$(get_input "SMTP 用户名 (邮箱地址)" "")
                    ALERT_SMTP_PASS=$(get_input "SMTP 密码" "")
                    ALERT_FROM_EMAIL=$(get_input "发件人邮箱" "")
                    ALERT_TO_EMAIL=$(get_input "收件人邮箱" "")
                    print_success "邮件告警已配置"
                    break
                    ;;
                3)
                    ALERT_TYPE="log"
                    print_success "使用日志记录"
                    break
                    ;;
                *)
                    print_error "无效选择"
                    ;;
            esac
        done
    else
        ALERT_TYPE="log"
        print_success "使用日志记录"
    fi

    ALERT_ENABLED="true"
}

# 创建管理员账号（完全自托管模式）
create_admin_account() {
    # 等待 Web 服务就绪
    echo "等待 Web 服务就绪..."
    local retries=60
    local web_url="http://localhost:3000"
    
    while [ $retries -gt 0 ]; do
        if curl -s "$web_url/health" > /dev/null 2>&1; then
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done

    if [ $retries -eq 0 ]; then
        print_warning "Web 服务启动超时，请手动创建管理员账号"
        return 1
    fi

    # 调用初始化 API 创建管理员账号
    local response
    response=$(curl -s -X POST "$web_url/api/auth/init" \
        -H "Content-Type: application/json" \
        -H "x-init-key: $ALBUM_SESSION_SECRET" \
        -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

    if echo "$response" | grep -q '"success":true'; then
        print_success "管理员账号已创建"
    elif echo "$response" | grep -q 'already exist'; then
        print_warning "管理员账号已存在"
    else
        print_warning "管理员账号创建失败: $response"
        print_warning "请访问 $APP_URL/admin/login 手动注册"
    fi
}

# 生成配置文件
generate_config() {
    print_step "9/9" "生成配置并部署"

    local env_file=".env.generated"

    echo ""
    echo -e "${CYAN}正在生成配置文件...${NC}"

    if [ "$DEPLOYMENT_MODE" = "hybrid" ]; then
        # 混合部署配置
        cat > "$env_file" << EOF
# ============================================
# PIS 配置文件 (混合部署)
# 自动生成于: $(date)
# ============================================

# ==================== 域名配置 ====================
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== Supabase 配置 ====================
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_URL=$SUPABASE_URL

# ==================== MinIO 配置 ====================
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET=$MINIO_BUCKET
STORAGE_PUBLIC_URL=$MEDIA_URL
MINIO_PUBLIC_URL=$MEDIA_URL

# ==================== Worker 配置 ====================
WORKER_API_KEY=$WORKER_API_KEY
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 安全配置 ====================
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET

# ==================== 告警配置 ====================
ALERT_ENABLED=$ALERT_ENABLED
ALERT_TYPE=$ALERT_TYPE
EOF
        if [ "$ALERT_TYPE" = "telegram" ]; then
            cat >> "$env_file" << EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
        elif [ "$ALERT_TYPE" = "email" ]; then
            cat >> "$env_file" << EOF
ALERT_SMTP_HOST=$ALERT_SMTP_HOST
ALERT_SMTP_PORT=$ALERT_SMTP_PORT
ALERT_SMTP_USER=$ALERT_SMTP_USER
ALERT_SMTP_PASS=$ALERT_SMTP_PASS
ALERT_FROM_EMAIL=$ALERT_FROM_EMAIL
ALERT_TO_EMAIL=$ALERT_TO_EMAIL
EOF
        fi

        # 复制为 .env
        cp "$env_file" .env
        print_success "配置已保存到 .env"

        echo ""
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}  部署说明${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""
        echo -e "${GREEN}1. 服务器端部署${NC}"
        echo ""
        echo "启动基础服务:"
        echo "  $ cd docker"
        echo "  $ docker-compose up -d"
        echo ""
        echo -e "${GREEN}2. Vercel 前端部署${NC}"
        echo ""
        echo "  a. 访问 https://vercel.com 导入你的 GitHub 仓库"
        echo "  b. 配置构建:"
        echo "     - Root Directory: apps/web"
        echo "     - Build Command: pnpm build"
        echo "  c. 添加环境变量（在 Vercel Dashboard）:"
        echo "     - NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
        echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
        echo "     - SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY"
        echo "     - NEXT_PUBLIC_APP_URL=$APP_URL"
        echo "     - NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL"
        echo "     - WORKER_API_KEY=$WORKER_API_KEY"
        echo "     - ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET"
        echo "  d. 点击 Deploy"
        echo ""
        echo -e "${GREEN}3. 绑定域名${NC}"
        echo ""
        echo "在 Vercel 中添加你的域名，按提示配置 DNS。"
        echo ""
        echo -e "${YELLOW}⚠️  重要: 记得将 $DOMAIN 的 A 记录指向你的服务器 IP${NC}"
        echo "   media.$DOMAIN 的 A 记录也指向你的服务器 IP"
        echo ""
        echo -e "${CYAN}========================================${NC}"

    else
        # 自托管部署配置
        if [ "$AUTH_MODE" = "custom" ]; then
            # 完全自托管模式
            cat > "$env_file" << EOF
# ============================================
# PIS 配置文件 (完全自托管 - 自定义认证)
# 自动生成于: $(date)
# ============================================

# ==================== 域名配置 ====================
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 认证模式 ====================
# custom = 自定义 JWT 认证（完全自托管）
AUTH_MODE=custom
NEXT_PUBLIC_AUTH_MODE=custom

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ==================== 管理员账号 ====================
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# ==================== MinIO 配置 ====================
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET=$MINIO_BUCKET
STORAGE_PUBLIC_URL=$MEDIA_URL
MINIO_PUBLIC_URL=$MEDIA_URL

# ==================== Worker 配置 ====================
WORKER_API_KEY=$WORKER_API_KEY

# ==================== 安全配置 ====================
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET
AUTH_JWT_SECRET=$ALBUM_SESSION_SECRET

# ==================== 告警配置 ====================
ALERT_ENABLED=$ALERT_ENABLED
ALERT_TYPE=$ALERT_TYPE
EOF
        else
            # 半自托管模式（Supabase Auth）
            cat > "$env_file" << EOF
# ============================================
# PIS 配置文件 (半自托管 - Supabase 认证)
# 自动生成于: $(date)
# ============================================

# ==================== 域名配置 ====================
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ==================== Supabase 配置（前端认证）====================
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_URL=$SUPABASE_URL

# ==================== MinIO 配置 ====================
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET=$MINIO_BUCKET
STORAGE_PUBLIC_URL=$MEDIA_URL
MINIO_PUBLIC_URL=$MEDIA_URL

# ==================== Worker 配置 ====================
WORKER_API_KEY=$WORKER_API_KEY

# ==================== 安全配置 ====================
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET

# ==================== 告警配置 ====================
ALERT_ENABLED=$ALERT_ENABLED
ALERT_TYPE=$ALERT_TYPE
EOF
        fi

        if [ "$ALERT_TYPE" = "telegram" ]; then
            cat >> "$env_file" << EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
        elif [ "$ALERT_TYPE" = "email" ]; then
            cat >> "$env_file" << EOF
ALERT_SMTP_HOST=$ALERT_SMTP_HOST
ALERT_SMTP_PORT=$ALERT_SMTP_PORT
ALERT_SMTP_USER=$ALERT_SMTP_USER
ALERT_SMTP_PASS=$ALERT_SMTP_PASS
ALERT_FROM_EMAIL=$ALERT_FROM_EMAIL
ALERT_TO_EMAIL=$ALERT_TO_EMAIL
EOF
        fi

        # 复制为 .env（docker-compose 读取 ../.env）
        cp "$env_file" ../.env
        print_success "配置已保存到 .env"

        echo ""
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}  开始部署${NC}"
        echo -e "${CYAN}========================================${NC}"
        # 生成自签名 SSL 证书（首次部署使用，后续可替换为 Let's Encrypt）
        echo ""
        echo -e "${YELLOW}正在生成自签名 SSL 证书...${NC}"
        if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
            mkdir -p nginx/ssl
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout nginx/ssl/key.pem \
                -out nginx/ssl/cert.pem \
                -subj "/CN=${DOMAIN:-localhost}" \
                2>/dev/null
            print_success "已生成自签名 SSL 证书（有效期 365 天）"
            print_warning "生产环境建议使用 Let's Encrypt 替换自签名证书"
        else
            print_success "SSL 证书已存在，跳过生成"
        fi

        echo ""
        echo -e "${YELLOW}正在构建 Docker 镜像...${NC}"
        $COMPOSE_CMD -f docker-compose.standalone.yml build

        echo ""
        echo -e "${YELLOW}正在启动服务...${NC}"
        $COMPOSE_CMD -f docker-compose.standalone.yml up -d

        # 等待数据库初始化
        echo ""
        echo -e "${YELLOW}等待服务启动...${NC}"
        sleep 5

        # 如果是完全自托管模式，创建管理员账号
        if [ "$AUTH_MODE" = "custom" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
            echo ""
            echo -e "${YELLOW}正在创建管理员账号...${NC}"
            create_admin_account
        fi

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  部署完成！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${GREEN}访问地址:${NC}"
        echo "  主站: $APP_URL"
        echo "  管理后台: $APP_URL/admin/login"
        echo ""
        echo -e "${GREEN}MinIO 控制台:${NC}"
        echo "  http://localhost:9001"
        echo "  用户名: $MINIO_ACCESS_KEY"
        echo "  密码: $MINIO_SECRET_KEY"
        echo ""
        echo -e "${GREEN}数据库连接:${NC}"
        echo "  主机: localhost"
        echo "  端口: 5432"
        echo "  数据库: $POSTGRES_DB"
        echo "  用户名: $POSTGRES_USER"
        echo "  密码: $POSTGRES_PASSWORD"
        echo ""

        if [ "$AUTH_MODE" = "custom" ]; then
            echo -e "${GREEN}管理员账号:${NC}"
            echo "  邮箱: $ADMIN_EMAIL"
            echo "  密码: $ADMIN_PASSWORD"
            echo ""
            echo -e "${YELLOW}⚠️  请妥善保管管理员密码！${NC}"
            echo ""
            echo -e "${YELLOW}下一步操作:${NC}"
            echo "  1. 访问 $APP_URL/admin/login 登录"
            echo "  2. （可选）配置 SSL 证书（使用 Let's Encrypt）"
        else
            echo -e "${YELLOW}⚠️  管理员账号:${NC}"
            echo "  请在 Supabase Dashboard 中查看"
            echo ""
            echo -e "${YELLOW}下一步操作:${NC}"
            echo "  1. 访问 $APP_URL/admin/login 登录"
            echo "  2. （可选）配置 SSL 证书（使用 Let's Encrypt）"
        fi
        echo ""
        echo -e "${YELLOW}查看日志:${NC}"
        echo "  cd $DOCKER_DIR && $COMPOSE_CMD -f docker-compose.standalone.yml logs -f"
        echo ""
        echo -e "${YELLOW}获取 Let's Encrypt 证书（可选）:${NC}"
        echo "  # 1. 停止 nginx"
        echo "  $COMPOSE_CMD -f docker-compose.standalone.yml stop nginx"
        echo "  # 2. 获取证书"
        echo "  certbot certonly --standalone -d $DOMAIN"
        echo "  # 3. 复制证书"
        echo "  cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem"
        echo "  cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem"
        echo "  # 4. 重启 nginx"
        echo "  $COMPOSE_CMD -f docker-compose.standalone.yml restart nginx"
        echo ""
    fi
    # 保存重要信息
    cat > .deployment-info << EOF
# PIS 部署信息
# 生成时间: $(date)
# ⚠️  警告: 此文件包含敏感信息，请妥善保管，不要泄露或提交到 Git

部署方式: $DEPLOYMENT_MODE
域名: $DOMAIN

# 重要密钥（请妥善保管）
Worker API Key: $WORKER_API_KEY
会话密钥: $ALBUM_SESSION_SECRET
MinIO 访问密钥: $MINIO_ACCESS_KEY
MinIO 密钥: $MINIO_SECRET_KEY

EOF
    if [ "$DEPLOYMENT_MODE" = "hybrid" ]; then
        cat >> .deployment-info << EOF
Supabase URL: $SUPABASE_URL
Supabase Anon Key: $SUPABASE_ANON_KEY
Supabase Service Key: $SUPABASE_SERVICE_KEY
EOF
    else
        cat >> .deployment-info << EOF
PostgreSQL 密码: $POSTGRES_PASSWORD
PostgreSQL 数据库: $POSTGRES_DB
PostgreSQL 用户名: $POSTGRES_USER
EOF
    fi

    print_success "部署信息已保存到 .deployment-info"
    print_warning "⚠️  请妥善保管 .deployment-info 文件，不要将其提交到 Git 或分享给他人"
    print_warning "⚠️  建议将其备份到安全的地方，然后删除此文件"
}

# 显示完成后信息
show_completion_info() {
    echo ""
    print_title "部署完成！"

    echo ""
    echo -e "${GREEN}✓ 配置文件已生成${NC}"
    echo -e "${GREEN}✓ 服务已启动${NC}"
    echo ""
    echo -e "${YELLOW}配置文件位置:${NC}"
    if [ "$DEPLOYMENT_MODE" = "hybrid" ]; then
        echo "  - .env"
        echo "  - .deployment-info"
    else
        echo "  - .env.standalone"
        echo "  - .deployment-info"
    fi
    echo ""
    echo -e "${YELLOW}常用命令:${NC}"
    if [ "$DEPLOYMENT_MODE" = "hybrid" ]; then
        echo "  查看状态: cd $DOCKER_DIR && $COMPOSE_CMD ps"
        echo "  查看日志: cd $DOCKER_DIR && $COMPOSE_CMD logs -f"
        echo "  重启服务: cd $DOCKER_DIR && $COMPOSE_CMD restart"
        echo "  停止服务: cd $DOCKER_DIR && $COMPOSE_CMD down"
    else
        echo "  查看状态: cd $DOCKER_DIR && $COMPOSE_CMD -f docker-compose.standalone.yml ps"
        echo "  查看日志: cd $DOCKER_DIR && $COMPOSE_CMD -f docker-compose.standalone.yml logs -f"
        echo "  重启服务: cd $DOCKER_DIR && $COMPOSE_CMD -f docker-compose.standalone.yml restart"
        echo "  停止服务: cd $DOCKER_DIR && $COMPOSE_CMD -f docker-compose.standalone.yml down"
    fi
    echo ""
    echo -e "${CYAN}如需重新配置，请运行: bash docker/deploy.sh${NC}"
}

# 主函数
main() {
    # 显示欢迎信息
    clear
    print_title "PIS 一键部署向导"

    echo ""
    echo -e "${BOLD}本脚本将引导你完成 PIS 的部署配置${NC}"
    echo ""
    echo -e "${YELLOW}部署前请确保:${NC}"
    echo "  • 已安装 Docker 和 Docker Compose"
    echo "  • 服务器端口 80 和 443 可用"
    echo "  • 域名已解析到服务器（如果使用域名）"
    echo ""

    if ! get_confirm "是否继续？" "y"; then
        echo "部署已取消"
        exit 0
    fi

    # 执行部署步骤
    check_docker
    choose_deployment_mode
    configure_domain

    if [ "$DEPLOYMENT_MODE" = "hybrid" ]; then
        configure_supabase
    else
        configure_postgres
    fi

    configure_minio
    configure_worker
    configure_security
    configure_alerts
    generate_config
    show_completion_info
}

# 运行主函数
main
