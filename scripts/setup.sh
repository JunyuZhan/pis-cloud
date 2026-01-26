#!/bin/bash

# PIS 引导式部署脚本
# 使用方法: bash scripts/setup.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# 检查命令是否存在
check_command() {
    if command -v $1 &> /dev/null; then
        success "$1 已安装"
        return 0
    else
        error "$1 未安装"
        return 1
    fi
}

# 主菜单
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   📸 PIS - 私有化即时摄影分享系统                          ║"
    echo "║       部署引导程序 v1.0                                    ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "请选择部署模式:"
    echo ""
    echo "  1) 🖥️  本地开发环境"
    echo "  2) 🚀 生产环境部署 (服务器端)"
    echo "  3) 🔧 仅配置环境变量"
    echo "  4) 🐳 启动/停止 Docker 服务"
    echo "  5) 🗄️  数据库架构初始化"
    echo "  6) 🔍 检查系统状态"
    echo "  7) 📖 查看部署文档"
    echo "  0) 退出"
    echo ""
    read -p "请输入选项 [0-7]: " choice
}

# 检查系统依赖
check_dependencies() {
    step "检查系统依赖"
    
    local all_ok=true
    
    check_command "node" || all_ok=false
    check_command "pnpm" || all_ok=false
    check_command "docker" || all_ok=false
    check_command "docker-compose" || { check_command "docker compose" || all_ok=false; }
    check_command "git" || all_ok=false
    
    if [ "$all_ok" = true ]; then
        success "所有依赖已就绪"
    else
        error "请先安装缺失的依赖"
        echo ""
        echo "安装指南:"
        echo "  Node.js: https://nodejs.org/ (推荐 v20+)"
        echo "  pnpm:    npm install -g pnpm"
        echo "  Docker:  https://docs.docker.com/get-docker/"
        return 1
    fi
}

# 配置环境变量
configure_env() {
    step "配置环境变量"
    
    echo "请准备好以下信息 (从 Supabase Dashboard 获取):"
    echo ""
    echo "  1. Project URL (例: https://xxxxx.supabase.co)"
    echo "  2. anon public key"
    echo "  3. service_role key (保密!)"
    echo ""
    read -p "准备好了吗? [y/N]: " ready
    
    if [[ ! "$ready" =~ ^[Yy]$ ]]; then
        warn "请先获取 Supabase 凭据后再运行此脚本"
        echo "获取方式: Supabase Dashboard → Settings → API"
        return 1
    fi
    
    # 验证环境变量
    validate_env_vars
}

# 验证环境变量
validate_env_vars() {
    step "验证环境变量"
    
    local env_file=".env.local"
    local errors=0
    
    if [ ! -f "$env_file" ]; then
        error "未找到 $env_file 文件"
        return 1
    fi
    
    # 检查必需的环境变量
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "STORAGE_TYPE"
        "STORAGE_ENDPOINT"
        "STORAGE_ACCESS_KEY"
        "STORAGE_SECRET_KEY"
        "STORAGE_BUCKET"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" || grep -q "^$var=.*your-.*" "$env_file" || grep -q "^$var=\"\"" "$env_file"; then
            error "环境变量 $var 未正确配置"
            errors=$((errors + 1))
        else
            success "环境变量 $var 已配置"
        fi
    done
    
    # 检查数据库类型
    if grep -q "^DATABASE_TYPE=" "$env_file"; then
        local db_type=$(grep "^DATABASE_TYPE=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        success "数据库类型: ${db_type:-supabase}"
    else
        warn "未设置 DATABASE_TYPE，将使用默认值 supabase"
    fi
    
    # 检查 Supabase URL 格式（仅当使用 Supabase 时）
    if grep -q "^DATABASE_TYPE=supabase" "$env_file" || ! grep -q "^DATABASE_TYPE=" "$env_file"; then
        if grep -q "NEXT_PUBLIC_SUPABASE_URL=.*supabase\.co" "$env_file"; then
            success "Supabase URL 格式正确"
        else
            error "Supabase URL 格式不正确"
            errors=$((errors + 1))
        fi
    fi
    
    # 检查是否使用了示例密钥
    if grep -q "minioadmin" "$env_file"; then
        local storage_type=$(grep "^STORAGE_TYPE=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "minio")
        if [ "$storage_type" != "minio" ]; then
            warn "检测到默认 MinIO 密钥，但 STORAGE_TYPE=${storage_type}，请检查配置"
        fi
    fi
    
    if [ $errors -eq 0 ]; then
        success "环境变量验证通过"
        return 0
    else
        error "发现 $errors 个环境变量配置问题"
        return 1
    fi
    
    echo ""
    read -p "Supabase Project URL: " SUPABASE_URL
    read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
    read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY
    
    # 验证输入
    if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_KEY" ]]; then
        error "所有字段都是必填的"
        return 1
    fi
    
    # 创建统一的根目录环境变量文件
    cat > .env.local << EOF
# ===========================================
# PIS 统一环境配置 (根目录)
# 本地开发: 此文件被 apps/web 和 services/worker 共享
# ===========================================

# ==================== 数据库配置 ====================
DATABASE_TYPE=supabase

# ==================== Supabase 数据库 ====================
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_URL=$SUPABASE_URL

# ==================== MinIO 存储配置 ====================
NEXT_PUBLIC_MEDIA_URL=http://localhost:19000/pis-photos
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=19000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos
STORAGE_PUBLIC_URL=http://localhost:19000/pis-photos
# 兼容旧配置
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=19000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos
MINIO_PUBLIC_URL=http://localhost:19000/pis-photos

# ==================== Worker 服务 ====================
WORKER_URL=http://localhost:3001
NEXT_PUBLIC_WORKER_URL=http://localhost:3001

# ==================== Redis ====================
REDIS_HOST=localhost
REDIS_PORT=16379

# ==================== 应用配置 ====================
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    
    success "已创建 .env.local (根目录统一配置)"
    success "环境变量配置完成!"
    echo ""
    info "提示: apps/web 和 services/worker 会自动从根目录读取配置"
}

# 本地开发环境设置
setup_local() {
    step "设置本地开发环境"
    
    # 检查依赖
    check_dependencies || return 1
    
    # 安装 npm 依赖
    info "安装项目依赖..."
    pnpm install
    success "依赖安装完成"
    
    # 检查环境变量
    if [[ ! -f ".env.local" ]]; then
        warn "未找到环境变量配置"
        configure_env || return 1
    fi
    
    # 启动 Docker 服务
    info "启动 MinIO 和 Redis..."
    cd docker
    docker-compose up -d minio redis minio-init
    cd ..
    
    # 等待服务启动
    info "等待服务启动..."
    sleep 5
    
    # 检查服务状态
    if curl -s http://localhost:19000/minio/health/live > /dev/null; then
        success "MinIO 已启动 (http://localhost:19000)"
    else
        error "MinIO 启动失败"
    fi
    
    echo ""
    success "本地开发环境设置完成!"
    echo ""
    echo "下一步:"
    echo "  1. 启动开发服务器: ${CYAN}pnpm dev${NC}"
    echo "  2. 访问前端: ${CYAN}http://localhost:3000${NC}"
    echo "  3. 管理后台: ${CYAN}http://localhost:3000/admin/login${NC}"
    echo "  4. MinIO 控制台: ${CYAN}http://localhost:19001${NC} (用户名/密码: minioadmin/minioadmin)"
    echo ""
    echo "提示: 首次使用需要在 Supabase 创建管理员账号"
}

# 生产环境部署
setup_production() {
    step "生产环境部署"
    
    echo "生产环境部署需要以下信息:"
    echo ""
    echo "  1. 主站域名 (例: photos.example.com)"
    echo "  2. 媒体域名 (例: media.example.com)"
    echo "  3. Supabase 凭据"
    echo ""
    
    read -p "主站域名: " APP_DOMAIN
    read -p "媒体域名: " MEDIA_DOMAIN
    read -p "Supabase URL: " SUPABASE_URL
    read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY
    
    # 生成随机密码
    MINIO_ACCESS=$(openssl rand -hex 8)
    MINIO_SECRET=$(openssl rand -hex 16)
    
    # 创建生产环境配置
    cat > .env << EOF
# ==================== 数据库配置 ====================
DATABASE_TYPE=supabase

# ==================== Supabase 数据库 ====================
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY

# ==================== MinIO 存储配置 ====================
# MinIO (使用随机生成的强密码)
MINIO_ACCESS_KEY=$MINIO_ACCESS
MINIO_SECRET_KEY=$MINIO_SECRET
MINIO_BUCKET=pis-photos
# 注意: 生产环境需要配置 MINIO_PUBLIC_URL 和 STORAGE_PUBLIC_URL

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379
EOF
    
    success "已创建 .env"
    
    echo ""
    echo "MinIO 凭据 (请保存):"
    echo "  Access Key: $MINIO_ACCESS"
    echo "  Secret Key: $MINIO_SECRET"
    echo ""
    
    # 显示 Vercel 环境变量
    echo "Vercel 环境变量配置:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=<从 Supabase 获取>"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY"
    echo "NEXT_PUBLIC_APP_URL=https://$APP_DOMAIN"
    echo "NEXT_PUBLIC_MEDIA_URL=https://$MEDIA_DOMAIN/pis-photos"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    read -p "是否启动 Docker 服务? [y/N]: " start_docker
    if [[ "$start_docker" =~ ^[Yy]$ ]]; then
        cd docker
        docker-compose up -d
        cd ..
        success "Docker 服务已启动"
    fi
    
    echo ""
    success "生产环境配置完成!"
    echo ""
    echo "下一步:"
    echo "  1. 配置 Nginx 反向代理 (参考 docker/nginx/media.conf)"
    echo "  2. 申请 SSL 证书"
    echo "  3. 在 Vercel 部署前端 (使用上面的环境变量)"
}

# Docker 服务管理
manage_docker() {
    step "Docker 服务管理"
    
    echo "1) 启动所有服务"
    echo "2) 停止所有服务"
    echo "3) 查看服务状态"
    echo "4) 查看日志"
    echo "5) 重启服务"
    echo "0) 返回"
    echo ""
    read -p "请选择 [0-5]: " docker_choice
    
    cd docker
    
    case $docker_choice in
        1)
            docker-compose up -d
            success "服务已启动"
            ;;
        2)
            docker-compose down
            success "服务已停止"
            ;;
        3)
            docker-compose ps
            ;;
        4)
            echo "选择要查看的服务:"
            echo "1) minio  2) redis  3) worker  4) 全部"
            read -p "选择: " log_choice
            case $log_choice in
                1) docker-compose logs -f minio ;;
                2) docker-compose logs -f redis ;;
                3) docker-compose logs -f worker ;;
                4) docker-compose logs -f ;;
            esac
            ;;
        5)
            docker-compose restart
            success "服务已重启"
            ;;
    esac
    
    cd ..
}

# 数据库架构
run_migrations() {
    step "数据库架构初始化"
    
    echo "⚠️  重要提示："
    echo "  - 数据库架构文件: database/full_schema.sql"
    echo "  - 仅适用于全新的数据库（首次安装）"
    echo "  - 只需执行一次即可完成所有数据库初始化"
    echo "  - 不要在已有数据的数据库上重复执行"
    echo ""
    
    # 检查当前配置的数据库类型
    local env_file=".env.local"
    local db_type="supabase"
    
    if [ -f "$env_file" ]; then
        if grep -q "^DATABASE_TYPE=" "$env_file"; then
            db_type=$(grep "^DATABASE_TYPE=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        fi
    fi
    
    echo "检测到的数据库类型: ${db_type:-supabase}"
    echo ""
    
    case "${db_type:-supabase}" in
        supabase)
            echo "📋 Supabase 执行步骤:"
            echo "  1. 打开 Supabase Dashboard -> SQL Editor"
            echo "  2. 复制 database/full_schema.sql 的全部内容"
            echo "  3. 粘贴并点击 Run 执行"
            echo "  4. ✅ 完成！"
            ;;
        postgresql)
            echo "📋 PostgreSQL 执行步骤:"
            echo "  1. 确保 PostgreSQL 服务已启动"
            echo "  2. 创建数据库（如果尚未创建）:"
            echo "     createdb pis"
            echo "  3. 执行架构脚本:"
            echo "     psql -h localhost -U postgres -d pis -f database/full_schema.sql"
            echo ""
            echo "  或者使用 DATABASE_URL:"
            echo "     psql \$DATABASE_URL < database/full_schema.sql"
            echo ""
            echo "  ⚠️  注意: PostgreSQL 需要自行实现用户认证和实时功能"
            ;;
        mysql)
            echo "📋 MySQL 执行步骤:"
            echo "  1. 确保 MySQL 服务已启动"
            echo "  2. 创建数据库（如果尚未创建）:"
            echo "     mysql -u root -p -e 'CREATE DATABASE IF NOT EXISTS pis;'"
            echo "  3. 执行架构脚本（需要先转换为 MySQL 语法）:"
            echo "     mysql -u root -p pis < database/full_schema.sql"
            echo ""
            echo "  ⚠️  注意:"
            echo "  - full_schema.sql 是 PostgreSQL 语法，需要转换为 MySQL 语法"
            echo "  - MySQL 适配器尚未完全实现（需要贡献代码）"
            echo "  - 需要自行实现用户认证和实时功能"
            ;;
        *)
            echo "📋 通用执行步骤:"
            echo "  根据你的数据库类型选择执行方式："
            echo ""
            echo "  Supabase:"
            echo "    在 Supabase Dashboard -> SQL Editor 中执行 full_schema.sql"
            echo ""
            echo "  PostgreSQL:"
            echo "    psql \$DATABASE_URL < database/full_schema.sql"
            echo ""
            echo "  MySQL:"
            echo "    需要先转换为 MySQL 语法，然后执行"
            ;;
    esac
    echo ""
}

# 检查系统状态
check_status() {
    step "系统状态检查"
    
    # 检查 Docker 服务
    echo "Docker 服务状态:"
    if [[ -f "docker/docker-compose.yml" ]]; then
        cd docker
        docker-compose ps 2>/dev/null || warn "Docker 服务未运行"
        cd ..
    fi
    
    echo ""
    
    # 检查 MinIO
    echo "MinIO 状态:"
    if curl -s http://localhost:19000/minio/health/live > /dev/null 2>&1; then
        success "MinIO 运行中 (http://localhost:19000)"
    else
        warn "MinIO 未运行或不可访问 (检查端口 19000)"
    fi
    
    # 检查 Redis
    echo "Redis 状态:"
    if docker exec pis-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        success "Redis 运行中"
    else
        warn "Redis 未运行或不可访问"
    fi
    
    echo ""
    
    # 检查环境变量
    echo "环境变量配置:"
    if [[ -f ".env.local" ]]; then
        success ".env.local 存在 (根目录统一配置)"
    else
        warn ".env.local 不存在，请运行配置向导"
    fi
    
    # 检查数据库架构文件
    echo ""
    echo "数据库架构文件:"
    if [[ -f "database/full_schema.sql" ]]; then
        success "database/full_schema.sql 存在（一次性执行即可）"
    else
        warn "database/full_schema.sql 不存在"
    fi
}

# 主循环
main() {
    while true; do
        show_menu
        
        case $choice in
            1)
                setup_local
                read -p "按回车键继续..."
                ;;
            2)
                setup_production
                read -p "按回车键继续..."
                ;;
            3)
                configure_env
                read -p "按回车键继续..."
                ;;
            4)
                manage_docker
                read -p "按回车键继续..."
                ;;
            5)
                run_migrations
                read -p "按回车键继续..."
                ;;
            6)
                check_status
                read -p "按回车键继续..."
                ;;
            7)
                if command -v open &> /dev/null; then
                    if [ -f "docs/i18n/zh-CN/DEPLOYMENT.md" ]; then
                        open docs/i18n/zh-CN/DEPLOYMENT.md
                    elif [ -f "docs/i18n/en/DEPLOYMENT.md" ]; then
                        open docs/i18n/en/DEPLOYMENT.md
                    fi
                elif command -v xdg-open &> /dev/null; then
                    if [ -f "docs/i18n/zh-CN/DEPLOYMENT.md" ]; then
                        xdg-open docs/i18n/zh-CN/DEPLOYMENT.md
                    elif [ -f "docs/i18n/en/DEPLOYMENT.md" ]; then
                        xdg-open docs/i18n/en/DEPLOYMENT.md
                    fi
                else
                    if [ -f "docs/i18n/zh-CN/DEPLOYMENT.md" ]; then
                        cat docs/i18n/zh-CN/DEPLOYMENT.md | less
                    elif [ -f "docs/i18n/en/DEPLOYMENT.md" ]; then
                        cat docs/i18n/en/DEPLOYMENT.md | less
                    fi
                fi
                ;;
            0)
                echo ""
                info "感谢使用 PIS 部署引导程序!"
                exit 0
                ;;
            *)
                warn "无效选项，请重试"
                sleep 1
                ;;
        esac
    done
}

# 运行主程序
main
