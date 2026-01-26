#!/bin/bash

# 上传 API 测试脚本（使用 curl 测试各个端点）
# 用法: ./scripts/test-upload-api.sh [album_id]
#
# 环境变量:
#   NEXT_PUBLIC_APP_URL - API 地址（默认: https://pic.albertzhan.top）
#   AUTH_COOKIE - 认证 Cookie（从浏览器开发者工具中复制）
#
# 示例:
#   export AUTH_COOKIE="sb-xxx-auth-token=xxx"
#   ./scripts/test-upload-api.sh 550e8400-e29b-41d4-a716-446655440000

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认使用生产环境，可以通过环境变量覆盖
API_URL="${NEXT_PUBLIC_APP_URL:-https://pic.albertzhan.top}"
ALBUM_ID="${1:-}"
AUTH_COOKIE="${AUTH_COOKIE:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  上传 API 端点测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ -z "$ALBUM_ID" ]; then
    echo -e "${RED}❌ 错误: 缺少相册 ID${NC}"
    echo "用法: $0 <album_id>"
    echo ""
    echo "环境变量:"
    echo "  NEXT_PUBLIC_APP_URL - API 地址（默认: https://pic.albertzhan.top）"
    echo "  AUTH_COOKIE - 认证 Cookie"
    echo ""
    echo -e "${YELLOW}提示: 获取 Cookie 的方法:${NC}"
    echo "  1. 在浏览器中登录管理后台"
    echo "  2. 打开开发者工具 (F12) → Network 标签"
    echo "  3. 刷新页面，查看任意请求的 Request Headers 中的 Cookie"
    echo "  4. 复制整个 Cookie 值并设置: export AUTH_COOKIE=\"你的Cookie值\""
    exit 1
fi

# 准备 curl headers
CURL_HEADERS=(-H "Content-Type: application/json")
if [ -n "$AUTH_COOKIE" ]; then
    CURL_HEADERS+=(-H "Cookie: $AUTH_COOKIE")
else
    echo -e "${YELLOW}⚠️  警告: 未设置 AUTH_COOKIE，测试可能会失败${NC}"
    echo ""
fi

# 测试 1: 获取上传凭证
echo -e "${BLUE}测试 1: 获取上传凭证${NC}"
echo "POST $API_URL/api/admin/albums/$ALBUM_ID/upload"
CRED_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/albums/$ALBUM_ID/upload" \
    "${CURL_HEADERS[@]}" \
    -d '{
        "filename": "test.jpg",
        "contentType": "image/jpeg",
        "fileSize": 1024
    }' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CRED_RESPONSE" | tail -n1)
CRED_BODY=$(echo "$CRED_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 成功 (HTTP $HTTP_CODE)${NC}"
    echo "$CRED_BODY" | jq '.' 2>/dev/null || echo "$CRED_BODY"
else
    echo -e "${RED}❌ 失败 (HTTP $HTTP_CODE)${NC}"
    echo "$CRED_BODY"
fi
echo ""

# 测试 2: 检查 pending 照片
echo -e "${BLUE}测试 2: 检查 pending 照片${NC}"
echo "POST $API_URL/api/admin/albums/$ALBUM_ID/check-pending"
CHECK_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/albums/$ALBUM_ID/check-pending" \
    "${CURL_HEADERS[@]}" \
    -w "\n%{http_code}")

CHECK_HTTP_CODE=$(echo "$CHECK_RESPONSE" | tail -n1)
CHECK_BODY=$(echo "$CHECK_RESPONSE" | sed '$d')

if [ "$CHECK_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 成功 (HTTP $CHECK_HTTP_CODE)${NC}"
    echo "$CHECK_BODY" | jq '.' 2>/dev/null || echo "$CHECK_BODY"
else
    echo -e "${YELLOW}⚠️  响应 (HTTP $CHECK_HTTP_CODE)${NC}"
    echo "$CHECK_BODY"
fi
echo ""

# 测试 3: 获取照片列表
echo -e "${BLUE}测试 3: 获取照片列表${NC}"
echo "GET $API_URL/api/admin/albums/$ALBUM_ID/photos"
PHOTOS_CURL_HEADERS=()
if [ -n "$AUTH_COOKIE" ]; then
    PHOTOS_CURL_HEADERS=(-H "Cookie: $AUTH_COOKIE")
fi
PHOTOS_RESPONSE=$(curl -s "$API_URL/api/admin/albums/$ALBUM_ID/photos" \
    "${PHOTOS_CURL_HEADERS[@]}" \
    -w "\n%{http_code}")

PHOTOS_HTTP_CODE=$(echo "$PHOTOS_RESPONSE" | tail -n1)
PHOTOS_BODY=$(echo "$PHOTOS_RESPONSE" | sed '$d')

if [ "$PHOTOS_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 成功 (HTTP $PHOTOS_HTTP_CODE)${NC}"
    PHOTO_COUNT=$(echo "$PHOTOS_BODY" | jq '.photos | length' 2>/dev/null || echo "N/A")
    echo "照片数量: $PHOTO_COUNT"
    echo "$PHOTOS_BODY" | jq '.photos[0:3]' 2>/dev/null || echo "（无法解析 JSON）"
else
    echo -e "${RED}❌ 失败 (HTTP $PHOTOS_HTTP_CODE)${NC}"
    echo "$PHOTOS_BODY"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ API 测试完成！${NC}"
echo ""
