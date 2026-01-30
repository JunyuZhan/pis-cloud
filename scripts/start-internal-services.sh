#!/bin/bash

# ============================================
# PIS 内网服务启动脚本
# 
# 用途：只启动内网容器（MinIO、Redis等基础服务）
# 不启动 Worker 和 Web 服务
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

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"

# 检测 Docker Compose 命令
detect_compose_cmd() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "未找到 Docker Compose"
        exit 1
    fi
    info "使用: $COMPOSE_CMD"
}

# 检查环境变量文件
check_env_file() {
    local env_file="$PROJECT_ROOT/.env"
    
    if [ ! -f "$env_file" ]; then
        error ".env 文件不存在: $env_file"
        echo ""
        echo "请先创建 .env 文件："
        echo "  1. 复制示例文件: cp .env.example .env"
        echo "  2. 或运行配置脚本: bash scripts/setup.sh"
        exit 1
    fi
    
    # 检查必需的 MinIO 环境变量
    local has_minio_key=false
    if grep -qE "^MINIO_ACCESS_KEY=|^STORAGE_ACCESS_KEY=" "$env_file" 2>/dev/null; then
        has_minio_key=true
    fi
    
    if [ "$has_minio_key" = false ]; then
        warn "未找到 MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY"
        warn "MinIO 服务可能无法正常启动"
        echo ""
        echo "请在 .env 文件中添加以下配置："
        echo "  MINIO_ACCESS_KEY=minioadmin"
        echo "  MINIO_SECRET_KEY=minioadmin"
        echo ""
        echo "或者使用新的配置格式："
        echo "  STORAGE_ACCESS_KEY=minioadmin"
        echo "  STORAGE_SECRET_KEY=minioadmin"
        echo ""
        warn "继续启动服务，但 MinIO 可能无法正常工作"
        sleep 2
    fi
}

# 检测 docker-compose 文件
detect_compose_file() {
    cd "$DOCKER_DIR"
    
    # 检查是否有激活的 docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILE="docker-compose.yml"
        success "使用: docker-compose.yml"
    elif [ -f "docker-compose.postgresql.yml" ]; then
        COMPOSE_FILE="docker-compose.postgresql.yml"
        warn "使用: docker-compose.postgresql.yml"
    elif [ -f "docker-compose.mysql.yml" ]; then
        COMPOSE_FILE="docker-compose.mysql.yml"
        warn "使用: docker-compose.mysql.yml"
    elif [ -f "docker-compose.standalone.yml" ]; then
        COMPOSE_FILE="docker-compose.standalone.yml"
        warn "使用: docker-compose.standalone.yml"
    else
        error "未找到 docker-compose 配置文件"
        exit 1
    fi
}

# 启动内网服务
start_internal_services() {
    step "启动内网服务"
    
    cd "$DOCKER_DIR"
    
    # 根据不同的 compose 文件，启动不同的服务
    case "$COMPOSE_FILE" in
        docker-compose.yml)
            # Supabase 版本：只启动 MinIO 和 Redis
            info "启动 MinIO 和 Redis..."
            $COMPOSE_CMD -f "$COMPOSE_FILE" up -d minio redis minio-init
            ;;
        docker-compose.postgresql.yml)
            # PostgreSQL 版本：启动 PostgreSQL、MinIO 和 Redis
            info "启动 PostgreSQL、MinIO 和 Redis..."
            $COMPOSE_CMD -f "$COMPOSE_FILE" up -d postgresql minio redis minio-init
            ;;
        docker-compose.mysql.yml)
            # MySQL 版本：启动 MySQL、MinIO 和 Redis
            info "启动 MySQL、MinIO 和 Redis..."
            $COMPOSE_CMD -f "$COMPOSE_FILE" up -d mysql minio redis minio-init
            ;;
        docker-compose.standalone.yml)
            # Standalone 版本：启动 PostgreSQL、MinIO 和 Redis（不启动 Web 和 Worker）
            info "启动 PostgreSQL、MinIO 和 Redis..."
            $COMPOSE_CMD -f "$COMPOSE_FILE" up -d postgres minio redis minio-init
            ;;
    esac
    
    success "内网服务已启动"
}

# 检查服务状态
check_services() {
    step "检查服务状态"
    
    cd "$DOCKER_DIR"
    
    echo ""
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps
    
    echo ""
    info "健康检查:"
    
    # 检查 MinIO
    echo -n "  MinIO: "
    if curl -s http://localhost:19000/minio/health/live > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # 检查 Redis
    echo -n "  Redis: "
    if docker exec pis-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # 检查数据库（如果存在）
    if [ "$COMPOSE_FILE" = "docker-compose.postgresql.yml" ] || [ "$COMPOSE_FILE" = "docker-compose.standalone.yml" ]; then
        echo -n "  PostgreSQL: "
        if docker exec pis-postgresql pg_isready -U pis_user -d pis > /dev/null 2>&1 || \
           docker exec pis-postgres pg_isready -U pis -d pis > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⧗${NC} (启动中...)"
        fi
    elif [ "$COMPOSE_FILE" = "docker-compose.mysql.yml" ]; then
        echo -n "  MySQL: "
        if docker exec pis-mysql mysqladmin ping -h localhost > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⧗${NC} (启动中...)"
        fi
    fi
}

# 显示服务信息
show_service_info() {
    step "服务访问信息"
    
    echo ""
    # 尝试从 .env 文件读取 MinIO 凭据
    local env_file="$PROJECT_ROOT/.env"
    local minio_user=""
    local minio_pass=""
    
    if [ -f "$env_file" ]; then
        # 读取 MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY
        minio_user=$(grep -E "^MINIO_ACCESS_KEY=|^STORAGE_ACCESS_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # 读取 MINIO_SECRET_KEY 或 STORAGE_SECRET_KEY
        minio_pass=$(grep -E "^MINIO_SECRET_KEY=|^STORAGE_SECRET_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    fi
    
    echo -e "${GREEN}MinIO 控制台:${NC}"
    echo "  URL: http://localhost:19001"
    if [ -n "$minio_user" ]; then
        echo "  用户名: $minio_user"
    else
        echo "  用户名: 从 .env 文件查看 (MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY)"
    fi
    if [ -n "$minio_pass" ]; then
        echo "  密码: $minio_pass"
    else
        echo "  密码: 从 .env 文件查看 (MINIO_SECRET_KEY 或 STORAGE_SECRET_KEY)"
    fi
    echo ""
    
    echo -e "${GREEN}MinIO API:${NC}"
    echo "  URL: http://localhost:19000"
    echo ""
    
    echo -e "${GREEN}Redis:${NC}"
    echo "  端口: 16379 (仅本地)"
    echo ""
    
    if [ "$COMPOSE_FILE" = "docker-compose.postgresql.yml" ] || [ "$COMPOSE_FILE" = "docker-compose.standalone.yml" ]; then
        echo -e "${GREEN}PostgreSQL:${NC}"
        echo "  端口: 15432 (PostgreSQL) 或 5432 (Standalone) - 仅本地"
        echo ""
    elif [ "$COMPOSE_FILE" = "docker-compose.mysql.yml" ]; then
        echo -e "${GREEN}MySQL:${NC}"
        echo "  端口: 13306 - 仅本地"
        echo ""
    fi
    
    echo -e "${YELLOW}提示:${NC}"
    echo "  - 这些服务仅在内网访问（127.0.0.1）"
    echo "  - Worker 和 Web 服务未启动"
    echo "  - 如需启动完整服务，请使用: cd docker && docker-compose up -d"
    echo ""
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   📸 PIS - 内网服务启动脚本                                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        exit 1
    fi
    
    # 检查环境变量文件
    check_env_file
    
    # 检测 Compose 命令
    detect_compose_cmd
    
    # 检测 compose 文件
    detect_compose_file
    
    # 启动服务
    start_internal_services
    
    # 等待服务启动
    info "等待服务启动..."
    sleep 8
    
    # 检查服务状态
    check_services
    
    # 显示服务信息
    show_service_info
    
    success "完成！"
}

# 运行主函数
main
