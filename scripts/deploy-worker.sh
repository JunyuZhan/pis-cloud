#!/bin/bash
# Worker 部署脚本
# 用于将 Worker 代码部署到服务器

set -e

SERVER="root@192.168.50.10"
SERVER_WORKER_DIR="/opt/pis/worker"
LOCAL_WORKER_DIR="$(cd "$(dirname "$0")/../services/worker" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
MODE="${1:-update}"  # update 或 full

if [ "$MODE" = "full" ]; then
    info "🚀 完整部署模式（第一次部署）"
    
    info "📦 传输所有文件..."
    
    # 1. 传输 package.json 和 tsconfig.json
    info "  传输 package.json 和 tsconfig.json..."
    scp "$LOCAL_WORKER_DIR/package.json" "$SERVER:$SERVER_WORKER_DIR/"
    scp "$LOCAL_WORKER_DIR/tsconfig.json" "$SERVER:$SERVER_WORKER_DIR/"
    
    # 2. 传输整个 src 目录
    info "  传输 src 目录..."
    rsync -avz --delete \
        "$LOCAL_WORKER_DIR/src/" \
        "$SERVER:$SERVER_WORKER_DIR/src/"
    
    info "✅ 文件传输完成"
    
elif [ "$MODE" = "update" ]; then
    info "🔄 增量更新模式（只更新修改的文件）"
    
    # 检查是否指定了文件
    if [ -n "$2" ]; then
        FILE="$2"
        info "  传输单个文件: $FILE"
        
        # 转换为服务器路径
        SERVER_FILE="$SERVER_WORKER_DIR/src/$FILE"
        LOCAL_FILE="$LOCAL_WORKER_DIR/src/$FILE"
        
        if [ ! -f "$LOCAL_FILE" ]; then
            error "文件不存在: $LOCAL_FILE"
            exit 1
        fi
        
        scp "$LOCAL_FILE" "$SERVER:$SERVER_FILE"
        info "✅ 文件传输完成: $FILE"
    else
        # 默认传输 index.ts
        info "  传输 index.ts..."
        scp "$LOCAL_WORKER_DIR/src/index.ts" "$SERVER:$SERVER_WORKER_DIR/src/index.ts"
        info "✅ index.ts 传输完成"
    fi
else
    error "未知模式: $MODE"
    echo "用法: $0 [full|update] [文件路径]"
    echo ""
    echo "示例:"
    echo "  $0 update              # 更新 index.ts"
    echo "  $0 update lib/redis.ts # 更新指定文件"
    echo "  $0 full                # 完整部署（第一次部署）"
    exit 1
fi

# 3. 重新构建和部署
info "🔨 在服务器上重新构建..."
ssh "$SERVER" "cd $SERVER_WORKER_DIR && docker build --network=host -f ../worker.Dockerfile -t pis-worker:latest ." || {
    error "构建失败"
    exit 1
}

info "🚀 重新部署容器..."
ssh "$SERVER" "cd /opt/pis && docker compose up -d --force-recreate worker" || {
    error "部署失败"
    exit 1
}

info "⏳ 等待容器启动..."
sleep 3

# 4. 验证部署
info "✅ 验证部署..."
ssh "$SERVER" "docker logs pis-worker --tail 10" || {
    warn "无法获取日志，但容器可能已启动"
}

info "🎉 部署完成！"
info ""
info "验证命令:"
info "  ssh $SERVER 'docker exec pis-worker node -e \"console.log(\\\"Worker running\\\")\"'"
info "  ssh $SERVER 'curl -s http://localhost:3001/health | jq'"
