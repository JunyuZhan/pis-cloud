#!/bin/bash

# ============================================
# PIS 服务器端部署状态检查脚本
# 用途: 在服务器上直接运行，检查所有服务状态
# 使用方法: 上传到服务器后运行 bash server-check.sh
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 PIS 部署状态检查${NC}"
echo "===================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境正常${NC}"
echo ""

# 1. 检查 Docker 服务状态
echo "1️⃣  Docker 服务状态"
echo "-------------------"

services=("pis-minio" "pis-redis" "pis-worker")

for service in "${services[@]}"; do
    status=$(docker ps --filter "name=$service" --format "{{.Status}}" 2>/dev/null)
    if [ -z "$status" ]; then
        echo -e "${RED}❌ $service: 未运行${NC}"
    else
        echo -e "${GREEN}✅ $service: $status${NC}"
    fi
done

echo ""

# 2. 检查端口监听
echo "2️⃣  端口监听状态"
echo "-------------------"

ports=("9000:MinIO API" "9001:MinIO Console" "6379:Redis" "3001:Worker HTTP")

for port_info in "${ports[@]}"; do
    port=$(echo $port_info | cut -d: -f1)
    name=$(echo $port_info | cut -d: -f2)
    
    if command -v ss &> /dev/null; then
        result=$(ss -tuln 2>/dev/null | grep ":$port ")
    else
        result=$(netstat -tuln 2>/dev/null | grep ":$port ")
    fi
    
    if [ -z "$result" ]; then
        echo -e "${YELLOW}⚠️  $name (端口 $port): 未监听${NC}"
    else
        echo -e "${GREEN}✅ $name (端口 $port): 正在监听${NC}"
    fi
done

echo ""

# 3. 检查环境变量文件
echo "3️⃣  配置文件检查"
echo "-------------------"

if [ -f "/opt/pis/.env" ]; then
    echo -e "${GREEN}✅ 环境变量文件存在${NC}"
    
    # 检查关键环境变量
    required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "MINIO_ACCESS_KEY" "MINIO_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" /opt/pis/.env 2>/dev/null; then
            echo -e "   ${GREEN}✓${NC} $var 已配置"
        else
            echo -e "   ${RED}✗${NC} $var 未配置"
        fi
    done
else
    echo -e "${RED}❌ 环境变量文件不存在 (/opt/pis/.env)${NC}"
fi

echo ""

# 4. 服务健康检查
echo "4️⃣  服务健康检查"
echo "-------------------"

# MinIO 健康检查
echo -n "MinIO 健康状态: "
minio_health=$(curl -s http://localhost:9000/minio/health/live 2>/dev/null)
if [ "$minio_health" = "OK" ]; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 异常 ($minio_health)${NC}"
fi

# Redis 连接检查
echo -n "Redis 连接状态: "
if docker ps --filter "name=pis-redis" --format "{{.Names}}" | grep -q "pis-redis"; then
    redis_ping=$(docker exec pis-redis redis-cli ping 2>/dev/null)
    if [ "$redis_ping" = "PONG" ]; then
        echo -e "${GREEN}✅ 正常${NC}"
    else
        echo -e "${RED}❌ 异常${NC}"
    fi
else
    echo -e "${RED}❌ Redis 容器未运行${NC}"
fi

# Worker HTTP API 健康检查
echo -n "Worker HTTP API: "
worker_health=$(curl -s http://localhost:3001/health 2>/dev/null)
if echo "$worker_health" | grep -q "ok"; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${YELLOW}⚠️  无法连接 ($worker_health)${NC}"
fi

echo ""

# 5. MinIO Bucket 检查
echo "5️⃣  MinIO Bucket 检查"
echo "-------------------"

if docker ps --filter "name=pis-minio" --format "{{.Names}}" | grep -q "pis-minio"; then
    bucket_check=$(docker exec pis-minio mc ls local/pis-photos 2>/dev/null | head -5)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Bucket 'pis-photos' 存在${NC}"
        file_count=$(docker exec pis-minio mc ls local/pis-photos 2>/dev/null | wc -l)
        echo "   文件数量: $file_count"
        if [ "$file_count" -gt 0 ]; then
            echo "   最近文件:"
            echo "$bucket_check" | head -3 | sed 's/^/   /'
        fi
    else
        echo -e "${YELLOW}⚠️  Bucket 'pis-photos' 可能不存在${NC}"
    fi
else
    echo -e "${RED}❌ MinIO 容器未运行${NC}"
fi

echo ""

# 6. Worker 日志检查
echo "6️⃣  Worker 最近日志 (最后10行)"
echo "-------------------"

if docker ps --filter "name=pis-worker" --format "{{.Names}}" | grep -q "pis-worker"; then
    docker logs --tail 10 pis-worker 2>/dev/null | sed 's/^/   /'
    
    # 检查是否有错误
    error_count=$(docker logs pis-worker 2>/dev/null | grep -i "error\|failed" | wc -l)
    if [ "$error_count" -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️  发现 $error_count 条错误日志${NC}"
    fi
else
    echo -e "${RED}❌ Worker 容器未运行${NC}"
fi

echo ""

# 7. 系统资源检查
echo "7️⃣  系统资源"
echo "-------------------"

# 磁盘空间
disk_usage=$(df -h / | tail -1 | awk '{print $5}')
echo "磁盘使用: $disk_usage"

# 内存使用
mem_info=$(free -h | grep Mem | awk '{print $3 "/" $2}')
echo "内存使用: $mem_info"

# Docker 容器资源
echo ""
echo "Docker 容器资源使用:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "NAME|pis-"

echo ""
echo "===================="
echo -e "${GREEN}检查完成！${NC}"
echo ""
echo "💡 常用命令:"
echo "  - 查看完整日志: cd /opt/pis/docker && docker-compose logs -f"
echo "  - 重启服务: cd /opt/pis/docker && docker-compose restart"
echo "  - 查看服务状态: cd /opt/pis/docker && docker-compose ps"
echo "  - 查看 Worker 日志: docker logs -f pis-worker"
