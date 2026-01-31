#!/bin/bash

# 集成测试运行脚本
# 用法: ./scripts/test-integration.sh [test-file]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 集成测试运行脚本 ===${NC}\n"

# 检查环境变量
if [ -z "$RUN_INTEGRATION_TESTS" ]; then
  echo -e "${YELLOW}警告: RUN_INTEGRATION_TESTS 未设置，将自动设置为 true${NC}"
  export RUN_INTEGRATION_TESTS=true
fi

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}错误: SUPABASE_URL 环境变量未设置${NC}"
  echo "请设置测试 Supabase 项目的 URL:"
  echo "  export SUPABASE_URL='your-test-supabase-url'"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}错误: SUPABASE_SERVICE_ROLE_KEY 环境变量未设置${NC}"
  echo "请设置测试 Supabase 项目的 Service Role Key:"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='your-test-service-role-key'"
  exit 1
fi

echo -e "${GREEN}环境变量检查通过${NC}"
echo "  SUPABASE_URL: ${SUPABASE_URL}"
echo "  RUN_INTEGRATION_TESTS: ${RUN_INTEGRATION_TESTS}"
echo ""

# 运行测试
if [ -z "$1" ]; then
  echo -e "${GREEN}运行所有集成测试...${NC}\n"
  pnpm test -- "**/*.integration.test.ts"
else
  echo -e "${GREEN}运行指定测试文件: $1${NC}\n"
  pnpm test -- "$1"
fi

echo -e "\n${GREEN}=== 测试完成 ===${NC}"
