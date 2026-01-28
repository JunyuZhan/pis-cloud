#!/bin/bash

# Worker 更新脚本 - 在服务器上运行
# 用途: 拉取最新代码，更新环境配置，重新构建 Worker 镜像

set -e

echo "🚀 Worker 更新脚本"
echo "=================="
echo ""

# 检查是否在服务器上
if [ -z "$SSH_CONNECTION" ] && [ "$1" != "--force" ]; then
  echo "⚠️  此脚本应在服务器上运行"
  echo "   如果要在本地运行，请使用 --force 参数"
  echo ""
  read -p "继续？(y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    exit 0
  fi
fi

# 项目目录（自动检测）
if [ -d "/opt/pis" ]; then
  PROJECT_DIR="/opt/pis"
elif [ -d "/opt/PIS" ]; then
  PROJECT_DIR="/opt/PIS"
elif [ -d "/root/pis" ]; then
  PROJECT_DIR="/root/pis"
elif [ -d "/root/PIS" ]; then
  PROJECT_DIR="/root/PIS"
else
  echo "❌ 未找到项目目录，请手动指定 PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "📁 项目目录: $PROJECT_DIR"
echo ""

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main
echo "✅ 代码更新完成"
echo ""

# 2. 检查环境配置文件
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  未找到 .env 文件"
  echo "   从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env"
  echo ""
fi

# 3. 检查 WORKER_API_KEY
if ! grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null || grep -q "^WORKER_API_KEY=your-secret-api-key-change-this-in-production" "$ENV_FILE" 2>/dev/null; then
  echo "⚠️  WORKER_API_KEY 未设置或使用示例值"
  echo ""
  read -p "是否要生成新的 API Key？(y/N): " generate
  if [ "$generate" = "y" ] || [ "$generate" = "Y" ]; then
    NEW_API_KEY=$(openssl rand -hex 32)
    if grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null; then
      # 替换现有的
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      else
        sed -i "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      fi
    else
      # 添加新的
      echo "" >> "$ENV_FILE"
      echo "# Worker API Key" >> "$ENV_FILE"
      echo "WORKER_API_KEY=${NEW_API_KEY}" >> "$ENV_FILE"
    fi
    echo "✅ 已生成并设置新的 API Key: ${NEW_API_KEY:0:20}..."
    echo ""
    echo "⚠️  重要: 请确保 Next.js 应用也使用相同的 API Key！"
    echo ""
  else
    echo "⚠️  跳过 API Key 设置，请手动配置"
    echo ""
  fi
else
  echo "✅ WORKER_API_KEY 已配置"
  echo ""
fi

# 4. 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
  echo "❌ Docker 未安装"
  exit 1
fi

# 检测 docker-compose 命令（支持新版本 docker compose 和旧版本 docker-compose）
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null 2>&1; then
  # 新版本 Docker（docker compose 作为插件）
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  # 旧版本 Docker（独立的 docker-compose 命令）
  DOCKER_COMPOSE_CMD="docker-compose"
else
  echo "❌ Docker Compose 未安装"
  echo "   请安装 Docker Compose 或更新 Docker 到最新版本"
  exit 1
fi

echo "✅ 使用 Docker Compose 命令: $DOCKER_COMPOSE_CMD"
echo ""

# 5. 重新构建 Worker 镜像
echo "🔨 重新构建 Worker 镜像..."
cd "$PROJECT_DIR"

# 优先使用 docker-compose（推荐方式）
if [ -f "docker/docker-compose.yml" ]; then
  echo "   使用 docker-compose 构建..."
  cd docker
  $DOCKER_COMPOSE_CMD build worker
  echo "✅ Worker 镜像构建完成"
  echo ""
  
  echo "🔄 重启 Worker 服务..."
  $DOCKER_COMPOSE_CMD restart worker
  echo "✅ Worker 服务已重启"
  cd ..
elif [ -f "docker-compose.yml" ]; then
  # 兼容根目录的 docker-compose.yml
  echo "   使用 docker-compose 构建（根目录）..."
  $DOCKER_COMPOSE_CMD build worker
  echo "✅ Worker 镜像构建完成"
  echo ""
  
  echo "🔄 重启 Worker 服务..."
  $DOCKER_COMPOSE_CMD restart worker
  echo "✅ Worker 服务已重启"
else
  # 使用 Dockerfile 直接构建
  if [ -f "docker/worker.Dockerfile" ]; then
    echo "   使用 Dockerfile 构建..."
    docker build --network=host -t pis-worker:latest -f docker/worker.Dockerfile .
    echo "✅ Worker 镜像构建完成"
    echo ""
    
    echo "🔄 重启 Worker 容器..."
    # 尝试重启现有容器，如果不存在则启动新容器
    if docker ps -a --format '{{.Names}}' | grep -q "^pis-worker$"; then
      docker restart pis-worker
    else
      # 如果使用 docker-compose，应该通过 docker-compose 启动
      if [ -f "docker/docker-compose.yml" ]; then
        cd docker
        $DOCKER_COMPOSE_CMD up -d worker
        cd ..
      else
        echo "⚠️  未找到容器，请使用 docker-compose 启动"
      fi
    fi
    echo "✅ Worker 容器已重启"
  elif [ -f "services/worker/Dockerfile" ]; then
    echo "   使用 Dockerfile 构建..."
    docker build --network=host -t pis-worker:latest -f services/worker/Dockerfile .
    echo "✅ Worker 镜像构建完成"
    echo ""
    
    echo "🔄 重启 Worker 容器..."
    docker restart pis-worker || echo "⚠️  请手动重启 Worker 容器"
  else
    echo "❌ 未找到 Dockerfile 或 docker-compose.yml"
    echo "   请检查项目结构或手动更新 Worker"
    exit 1
  fi
fi

echo ""
echo "📋 验证步骤:"
echo "   1. 检查 Worker 日志:"
echo "      docker logs pis-worker --tail 20"
echo ""
echo "   2. 测试健康检查（本地）:"
echo "      curl http://localhost:3001/health"
echo "      # 应该返回健康状态（不需要 API Key）"
echo ""
echo "   3. 检查 Worker 服务状态:"
if [ -f "docker/docker-compose.yml" ] || [ -f "docker-compose.yml" ]; then
  if [ -f "docker/docker-compose.yml" ]; then
    echo "      cd docker && $DOCKER_COMPOSE_CMD ps worker"
  else
    echo "      $DOCKER_COMPOSE_CMD ps worker"
  fi
else
  echo "      docker ps --filter 'name=pis-worker'"
fi
echo ""
echo "✅ Worker 更新完成！"
echo ""
echo "💡 提示: 如果 Worker 使用公网模式，可以通过以下方式测试:"
echo "   curl http://$(hostname -I | awk '{print $1}'):3001/health"
echo ""
