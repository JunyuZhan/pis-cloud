#!/bin/bash

# PIS Worker 镜像重构脚本
# 用于在服务器上拉取最新代码并重构 worker 镜像

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PIS Worker 镜像重构脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 获取项目目录
PROJECT_DIR=$(pwd)
DOCKER_DIR="$PROJECT_DIR/docker"

echo -e "${YELLOW}1. 拉取最新代码...${NC}"
git pull origin main || {
    echo -e "${RED}错误: Git 拉取失败${NC}"
    exit 1
}
echo -e "${GREEN}✓ 代码拉取成功${NC}"

echo -e "${YELLOW}2. 检查 Docker Compose 配置...${NC}"
if [ ! -f "$DOCKER_DIR/docker-compose.yml" ]; then
    echo -e "${RED}错误: 找不到 docker-compose.yml${NC}"
    exit 1
fi

# 切换到 docker 目录
cd "$DOCKER_DIR"

echo -e "${YELLOW}3. 停止并删除旧的 worker 容器...${NC}"
docker-compose stop worker 2>/dev/null || true
docker-compose rm -f worker 2>/dev/null || true
echo -e "${GREEN}✓ 旧容器已停止并删除${NC}"

echo -e "${YELLOW}4. 删除旧的 worker 镜像（可选）...${NC}"
# 查找并删除旧的 worker 镜像
OLD_IMAGE=$(docker images | grep "pis.*worker" | awk '{print $3}' | head -1)
if [ ! -z "$OLD_IMAGE" ]; then
    docker rmi "$OLD_IMAGE" 2>/dev/null || echo -e "${YELLOW}  警告: 无法删除旧镜像（可能正在使用）${NC}"
fi

echo -e "${YELLOW}5. 重新构建 worker 镜像...${NC}"
docker-compose build --no-cache worker || {
    echo -e "${RED}错误: Worker 镜像构建失败${NC}"
    exit 1
}
echo -e "${GREEN}✓ Worker 镜像构建成功${NC}"

echo -e "${YELLOW}6. 启动 worker 容器...${NC}"
docker-compose up -d worker || {
    echo -e "${RED}错误: Worker 容器启动失败${NC}"
    exit 1
}
echo -e "${GREEN}✓ Worker 容器启动成功${NC}"

echo -e "${YELLOW}7. 检查 worker 容器状态...${NC}"
sleep 3
docker-compose ps worker

echo -e "${YELLOW}8. 查看 worker 日志（最近 20 行）...${NC}"
docker-compose logs --tail=20 worker

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Worker 镜像重构完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "查看完整日志: ${YELLOW}cd $DOCKER_DIR && docker-compose logs -f worker${NC}"
echo -e "查看容器状态: ${YELLOW}cd $DOCKER_DIR && docker-compose ps${NC}"
