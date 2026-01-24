#!/bin/bash

# ============================================
# PIS 部署状态检查脚本
# 用途: 检查服务器上的服务运行状态
# 使用方法: ./scripts/check-deployment.sh [SSH_HOST]
# ============================================

SSH_HOST=${1:-"192.168.50.10"}
SSH_USER=${SSH_USER:-"root"}

echo "🔍 PIS 部署状态检查"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_service() {
    local service=$1
    local status=$(ssh $SSH_USER@$SSH_HOST "docker ps --filter 'name=$service' --format '{{.Status}}' 2>/dev/null")
    
    if [ -z "$status" ]; then
        echo -e "${RED}❌ $service: 未运行${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $service: $status${NC}"
        return 0
    fi
}

check_port() {
    local port=$1
    local name=$2
    local result=$(ssh $SSH_USER@$SSH_HOST "netstat -tuln 2>/dev/null | grep ':$port ' || ss -tuln 2>/dev/null | grep ':$port '")
    
    if [ -z "$result" ]; then
        echo -e "${YELLOW}⚠️  $name (端口 $port): 未监听${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $name (端口 $port): 正在监听${NC}"
        return 0
    fi
}

check_file() {
    local file=$1
    local name=$2
    local result=$(ssh $SSH_USER@$SSH_HOST "test -f $file && echo 'exists' || echo 'not found'")
    
    if [ "$result" = "exists" ]; then
        echo -e "${GREEN}✅ $name: 文件存在${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: 文件不存在${NC}"
        return 1
    fi
}

check_env_var() {
    local var=$1
    local name=$2
    local result=$(ssh $SSH_USER@$SSH_HOST "grep -q '^$var=' /opt/pis/.env 2>/dev/null && echo 'exists' || echo 'not found'")
    
    if [ "$result" = "exists" ]; then
        echo -e "${GREEN}✅ $name: 已配置${NC}"
        return 0
    else
        echo -e "${RED}❌ $name: 未配置${NC}"
        return 1
    fi
}

echo "1️⃣  Docker 服务状态"
echo "-------------------"
check_service "pis-minio"
check_service "pis-redis"
check_service "pis-worker"
check_service "pis-minio-init"

echo ""
echo "2️⃣  端口监听状态"
echo "-------------------"
check_port "9000" "MinIO API"
check_port "9001" "MinIO Console"
check_port "6379" "Redis"
check_port "3001" "Worker HTTP API"

echo ""
echo "3️⃣  文件检查"
echo "-------------------"
check_file "/opt/pis/.env" "环境变量文件"
check_file "/opt/pis/docker/docker-compose.yml" "Docker Compose 配置"
check_file "/opt/pis/docker/worker.Dockerfile" "Worker Dockerfile"

echo ""
echo "4️⃣  环境变量检查"
echo "-------------------"
check_env_var "SUPABASE_URL" "Supabase URL"
check_env_var "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key"
check_env_var "MINIO_ACCESS_KEY" "MinIO Access Key"
check_env_var "MINIO_SECRET_KEY" "MinIO Secret Key"

echo ""
echo "5️⃣  服务健康检查"
echo "-------------------"

# MinIO 健康检查
echo -n "MinIO 健康状态: "
minio_health=$(ssh $SSH_USER@$SSH_HOST "curl -s http://localhost:9000/minio/health/live 2>/dev/null")
if [ "$minio_health" = "OK" ]; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 异常${NC}"
fi

# Redis 连接检查
echo -n "Redis 连接状态: "
redis_ping=$(ssh $SSH_USER@$SSH_HOST "docker exec pis-redis redis-cli ping 2>/dev/null")
if [ "$redis_ping" = "PONG" ]; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 异常${NC}"
fi

# Worker 日志检查
echo ""
echo "6️⃣  Worker 最近日志 (最后10行)"
echo "-------------------"
ssh $SSH_USER@$SSH_HOST "docker logs --tail 10 pis-worker 2>/dev/null || echo '无法获取日志'"

echo ""
echo "7️⃣  MinIO Bucket 检查"
echo "-------------------"
bucket_check=$(ssh $SSH_USER@$SSH_HOST "docker exec pis-minio mc ls local/pis-photos 2>/dev/null | head -5")
if [ -n "$bucket_check" ]; then
    echo -e "${GREEN}✅ Bucket 存在，文件列表:${NC}"
    echo "$bucket_check"
else
    echo -e "${YELLOW}⚠️  Bucket 可能不存在或为空${NC}"
fi

echo ""
echo "8️⃣  磁盘空间检查"
echo "-------------------"
ssh $SSH_USER@$SSH_HOST "df -h / | tail -1"

echo ""
echo "===================="
echo "检查完成！"
echo ""
echo "💡 提示:"
echo "  - 查看完整日志: ssh $SSH_USER@$SSH_HOST 'cd /opt/pis/docker && docker-compose logs -f'"
echo "  - 重启服务: ssh $SSH_USER@$SSH_HOST 'cd /opt/pis/docker && docker-compose restart'"
echo "  - 查看服务状态: ssh $SSH_USER@$SSH_HOST 'cd /opt/pis/docker && docker-compose ps'"
