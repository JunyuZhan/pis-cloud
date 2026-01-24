#!/bin/bash

# ============================================
# PIS 部署测试脚本
# 用途: 全面测试系统功能
# ============================================

SSH_HOST=${1:-"192.168.50.10"}
SSH_USER=${SSH_USER:-"root"}

echo "🧪 PIS 系统功能测试"
echo "===================="
echo "服务器: $SSH_USER@$SSH_HOST"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

test_check() {
    local name=$1
    local command=$2
    
    echo -n "测试 $name... "
    result=$(ssh $SSH_USER@$SSH_HOST "$command" 2>&1)
    
    if [ $? -eq 0 ] && [ -n "$result" ]; then
        echo -e "${GREEN}✅ 通过${NC}"
        echo "   结果: $result"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}❌ 失败${NC}"
        echo "   错误: $result"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo -e "${BLUE}1️⃣  服务状态测试${NC}"
echo "-------------------"

test_check "Docker Compose 服务" "cd /opt/pis && docker compose ps | grep -E 'pis-minio|pis-redis|pis-worker' | wc -l | grep -q '3' && echo '3个服务运行中'"

test_check "MinIO 容器状态" "docker ps | grep pis-minio | grep -q 'Up' && echo 'MinIO 运行中'"

test_check "Redis 容器状态" "docker ps | grep pis-redis | grep -q 'Up' && echo 'Redis 运行中'"

test_check "Worker 容器状态" "docker ps | grep pis-worker | grep -q 'Up' && echo 'Worker 运行中'"

echo ""
echo -e "${BLUE}2️⃣  端口监听测试${NC}"
echo "-------------------"

test_check "MinIO API 端口 19000" "ss -tuln | grep -q ':19000 ' && echo '端口监听正常'"

test_check "Redis 端口 16379" "ss -tuln | grep -q ':16379 ' && echo '端口监听正常'"

test_check "Worker API 端口 3001" "ss -tuln | grep -q ':3001 ' && echo '端口监听正常'"

echo ""
echo -e "${BLUE}3️⃣  健康检查测试${NC}"
echo "-------------------"

test_check "MinIO 健康检查" "curl -s http://localhost:19000/minio/health/live | grep -q 'OK' && echo 'OK'"

test_check "Redis 连接测试" "docker exec pis-redis redis-cli ping | grep -q 'PONG' && echo 'PONG'"

test_check "Worker API 健康检查" "curl -s http://localhost:3001/health | grep -q 'ok' && echo 'ok'"

echo ""
echo -e "${BLUE}4️⃣  网络连接测试${NC}"
echo "-------------------"

test_check "Worker → MinIO 网络" "docker exec pis-worker ping -c 1 minio >/dev/null 2>&1 && echo '连接正常'"

test_check "Worker → Redis 网络" "docker exec pis-worker ping -c 1 redis >/dev/null 2>&1 && echo '连接正常'"

echo ""
echo -e "${BLUE}5️⃣  MinIO Bucket 测试${NC}"
echo "-------------------"

test_check "pis-photos Bucket 存在" "docker run --rm --network pis-network minio/mc:latest mc alias set pis http://minio:9000 minioadmin minioadmin >/dev/null 2>&1 && docker run --rm --network pis-network minio/mc:latest mc ls pis/pis-photos >/dev/null 2>&1 && echo 'Bucket 存在'"

echo ""
echo -e "${BLUE}6️⃣  Worker 配置测试${NC}"
echo "-------------------"

test_check "Worker MinIO 配置" "docker exec pis-worker env | grep 'MINIO_ENDPOINT_HOST=minio' >/dev/null && echo '配置正确'"

test_check "Worker Redis 配置" "docker exec pis-worker env | grep 'REDIS_HOST=redis' >/dev/null && echo '配置正确'"

test_check "Worker 日志无错误" "cd /opt/pis && docker compose logs worker --tail 50 2>&1 | grep -i 'error\|failed' | wc -l | grep -q '^0$' && echo '无错误'"

echo ""
echo -e "${BLUE}7️⃣  FRP 配置测试${NC}"
echo "-------------------"

test_check "FRP pis-media 端口配置" "grep -A 3 'name = \"pis-media\"' /opt/1panel/apps/frpc/frpc/data/frpc.toml | grep -q 'localPort = 19000' && echo '端口配置正确'"

test_check "FRP 服务运行" "docker ps | grep frpc | grep -q 'Up' && echo 'FRP 运行中'"

echo ""
echo -e "${BLUE}8️⃣  外部访问测试${NC}"
echo "-------------------"

test_check "外部 MinIO 访问" "curl -s --max-time 5 https://media.albertzhan.top/minio/health/live | grep -q 'OK' && echo '外部访问正常'"

echo ""
echo "===================="
echo -e "${BLUE}测试结果汇总${NC}"
echo "-------------------"
echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
echo -e "失败: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！系统运行正常。${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部分测试失败，请检查上述错误。${NC}"
    exit 1
fi
