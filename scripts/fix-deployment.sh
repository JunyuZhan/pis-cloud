#!/bin/bash

# ============================================
# PIS 部署修复脚本
# 用途: 修复部署中发现的问题
# ============================================

SSH_HOST=${1:-"192.168.50.10"}
SSH_USER=${SSH_USER:-"root"}

echo "🔧 PIS 部署修复脚本"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}开始修复...${NC}"
echo ""

# 1. 检查并创建必要的目录结构
echo "1️⃣  检查目录结构"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ ! -d "/opt/pis/docker" ]; then
    echo "创建目录结构..."
    mkdir -p /opt/pis/docker
    mkdir -p /opt/pis/services/worker/src
    echo "✅ 目录已创建"
else
    echo "✅ 目录已存在"
fi
EOF

# 2. 检查环境变量文件
echo ""
echo "2️⃣  检查环境变量配置"
ssh $SSH_USER@$SSH_HOST << 'EOF'
if [ ! -f "/opt/pis/.env" ]; then
    echo "❌ 环境变量文件不存在"
    exit 1
fi

# 检查是否缺少 MinIO 配置
if ! grep -q "^MINIO_ACCESS_KEY=" /opt/pis/.env; then
    echo "⚠️  缺少 MINIO_ACCESS_KEY，添加默认值..."
    echo "" >> /opt/pis/.env
    echo "# MinIO 配置" >> /opt/pis/.env
    echo "MINIO_ACCESS_KEY=minioadmin" >> /opt/pis/.env
    echo "MINIO_SECRET_KEY=minioadmin" >> /opt/pis/.env
    echo "✅ 已添加 MinIO 配置"
else
    echo "✅ MinIO 配置已存在"
fi
EOF

# 3. 检查 Docker Compose 文件
echo ""
echo "3️⃣  检查 Docker Compose 配置"
docker_compose_exists=$(ssh $SSH_USER@$SSH_HOST "test -f /opt/pis/docker/docker-compose.yml && echo 'exists' || echo 'not found'")

if [ "$docker_compose_exists" = "not found" ]; then
    echo -e "${YELLOW}⚠️  Docker Compose 文件不存在，需要上传${NC}"
    echo "请运行: scp docker/docker-compose.yml $SSH_USER@$SSH_HOST:/opt/pis/docker/"
else
    echo -e "${GREEN}✅ Docker Compose 文件存在${NC}"
fi

# 4. 启动缺失的服务
echo ""
echo "4️⃣  启动缺失的服务"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis/docker 2>/dev/null || {
    echo "❌ /opt/pis/docker 目录不存在"
    exit 1
}

# 检查 MinIO 是否运行
if ! docker ps --filter "name=pis-minio" --format "{{.Names}}" | grep -q "pis-minio"; then
    echo "启动 MinIO..."
    docker-compose up -d minio minio-init 2>&1 || echo "⚠️  MinIO 启动失败，请检查配置"
else
    echo "✅ MinIO 已在运行"
fi

# 检查 Redis 是否运行
if ! docker ps --filter "name=pis-redis" --format "{{.Names}}" | grep -q "pis-redis"; then
    echo "启动 Redis..."
    docker-compose up -d redis 2>&1 || echo "⚠️  Redis 启动失败，请检查配置"
else
    echo "✅ Redis 已在运行"
fi
EOF

# 5. 等待服务启动
echo ""
echo "5️⃣  等待服务启动..."
sleep 5

# 6. 验证服务状态
echo ""
echo "6️⃣  验证服务状态"
ssh $SSH_USER@$SSH_HOST << 'EOF'
cd /opt/pis/docker
echo "Docker 服务状态:"
docker-compose ps

echo ""
echo "服务健康检查:"
echo -n "MinIO: "
curl -s http://localhost:9000/minio/health/live || echo "❌ 无法连接"

echo -n "Redis: "
docker exec pis-redis redis-cli ping 2>/dev/null || echo "❌ 无法连接"
EOF

echo ""
echo "===================="
echo -e "${GREEN}修复完成！${NC}"
echo ""
echo "💡 如果仍有问题，请检查:"
echo "  1. Docker Compose 文件是否正确上传"
echo "  2. 环境变量配置是否正确"
echo "  3. 查看日志: ssh $SSH_USER@$SSH_HOST 'cd /opt/pis/docker && docker-compose logs'"
