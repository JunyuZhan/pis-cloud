#!/bin/bash

# ============================================
# PIS 独立部署脚本
# 用途: 使用独立端口部署 MinIO 和 Redis，避免端口冲突
# ============================================

set -e

SSH_HOST=${1:-"your-server-ip"}
SSH_USER=${SSH_USER:-"root"}

echo "🚀 PIS 独立部署脚本"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查端口占用
echo -e "${BLUE}1️⃣  检查端口占用${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
echo "检查端口 19000, 19001, 16379, 3001..."
if command -v ss &> /dev/null; then
    ss -tuln | grep -E ":(19000|19001|16379|3001) " && echo "⚠️  端口被占用" || echo "✅ 端口可用"
else
    netstat -tuln | grep -E ":(19000|19001|16379|3001) " && echo "⚠️  端口被占用" || echo "✅ 端口可用"
fi
EOF

# 2. 上传必要文件
echo ""
echo -e "${BLUE}2️⃣  上传配置文件${NC}"
echo "上传 docker-compose.yml..."
scp docker/docker-compose.yml $SSH_USER@$SSH_HOST:/opt/pis/docker/ 2>/dev/null || {
    echo "⚠️  文件上传失败，请手动上传"
}

# 3. 检查并更新环境变量
echo ""
echo -e "${BLUE}3️⃣  检查环境变量${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis

if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在，请先创建"
    exit 1
fi

# 确保包含必要的配置
if ! grep -q "^MINIO_ACCESS_KEY=" .env; then
    echo "添加 MinIO 配置..."
    echo "" >> .env
    echo "# MinIO 配置" >> .env
    echo "MINIO_ACCESS_KEY=minioadmin" >> .env
    echo "MINIO_SECRET_KEY=minioadmin" >> .env
fi

if ! grep -q "^MINIO_ENDPOINT_HOST=" .env; then
    echo "MINIO_ENDPOINT_HOST=minio" >> .env
fi

if ! grep -q "^MINIO_ENDPOINT_PORT=" .env; then
    echo "MINIO_ENDPOINT_PORT=9000" >> .env
fi

if ! grep -q "^REDIS_HOST=" .env; then
    echo "REDIS_HOST=redis" >> .env
fi

if ! grep -q "^REDIS_PORT=" .env; then
    echo "REDIS_PORT=6379" >> .env
fi

echo "✅ 环境变量检查完成"
EOF

# 4. 停止旧服务（如果存在）
echo ""
echo -e "${BLUE}4️⃣  停止旧服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis/docker 2>/dev/null || exit 0

if [ -f "docker-compose.yml" ]; then
    echo "停止旧服务..."
    docker-compose down 2>/dev/null || true
    echo "✅ 旧服务已停止"
else
    echo "⚠️  docker-compose.yml 不存在，跳过"
fi
EOF

# 5. 启动服务
echo ""
echo -e "${BLUE}5️⃣  启动服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis/docker

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml 不存在"
    exit 1
fi

echo "启动服务..."
docker-compose up -d

echo "等待服务启动..."
sleep 10

echo "检查服务状态..."
docker-compose ps
EOF

# 6. 验证服务
echo ""
echo -e "${BLUE}6️⃣  验证服务${NC}"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis/docker

echo "健康检查:"
echo -n "MinIO: "
curl -s http://localhost:19000/minio/health/live || echo "❌"

echo -n "Redis: "
docker exec pis-redis redis-cli ping 2>/dev/null || echo "❌"

echo -n "Worker: "
curl -s http://localhost:3001/health || echo "❌"

echo ""
echo "端口监听状态:"
if command -v ss &> /dev/null; then
    ss -tuln | grep -E ":(19000|19001|16379|3001) "
else
    netstat -tuln | grep -E ":(19000|19001|16379|3001) "
fi
EOF

echo ""
echo "===================="
echo -e "${GREEN}部署完成！${NC}"
echo ""
echo "💡 提示:"
echo "  - MinIO API: http://localhost:19000"
echo "  - MinIO Console: http://localhost:19001"
echo "  - Redis: localhost:16379"
echo "  - Worker API: http://localhost:3001"
echo ""
echo "📝 下一步:"
echo "  1. 配置 Nginx 反向代理（使用端口 19000）"
echo "  2. 更新前端环境变量 NEXT_PUBLIC_MEDIA_URL"
echo "  3. 测试上传功能"
