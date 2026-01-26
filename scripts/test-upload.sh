#!/bin/bash

# 上传功能测试脚本
# 用法: ./scripts/test-upload.sh [album_id] [image_path]
# 
# 环境变量:
#   NEXT_PUBLIC_APP_URL - API 地址（默认: https://pic.albertzhan.top）
#   AUTH_COOKIE - 认证 Cookie（从浏览器开发者工具中复制）
#
# 示例:
#   export AUTH_COOKIE="sb-xxx-auth-token=xxx"
#   ./scripts/test-upload.sh 550e8400-e29b-41d4-a716-446655440000 /path/to/image.jpg

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
# 默认使用生产环境，可以通过环境变量覆盖
API_URL="${NEXT_PUBLIC_APP_URL:-https://pic.albertzhan.top}"
ALBUM_ID="${1:-}"
IMAGE_PATH="${2:-}"
AUTH_COOKIE="${AUTH_COOKIE:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  照片上传功能测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查参数
if [ -z "$ALBUM_ID" ]; then
    echo -e "${RED}❌ 错误: 缺少相册 ID${NC}"
    echo "用法: $0 <album_id> [image_path]"
    echo ""
    echo "环境变量:"
    echo "  NEXT_PUBLIC_APP_URL - API 地址（默认: https://pic.albertzhan.top）"
    echo "  AUTH_COOKIE - 认证 Cookie（从浏览器开发者工具中复制）"
    echo ""
    echo "示例:"
    echo "  export AUTH_COOKIE=\"sb-xxx-auth-token=xxx\""
    echo "  $0 550e8400-e29b-41d4-a716-446655440000 /path/to/image.jpg"
    echo ""
    echo -e "${YELLOW}提示: 获取 Cookie 的方法:${NC}"
    echo "  1. 在浏览器中登录管理后台"
    echo "  2. 打开开发者工具 (F12)"
    echo "  3. 切换到 Network 标签"
    echo "  4. 刷新页面，找到任意请求"
    echo "  5. 查看 Request Headers 中的 Cookie 值"
    echo "  6. 复制整个 Cookie 值并设置: export AUTH_COOKIE=\"你的Cookie值\""
    exit 1
fi

# 检查认证
if [ -z "$AUTH_COOKIE" ]; then
    echo -e "${YELLOW}⚠️  警告: 未设置 AUTH_COOKIE 环境变量${NC}"
    echo "测试可能会因为认证失败而无法进行"
    echo ""
    echo "设置方法:"
    echo "  export AUTH_COOKIE=\"你的Cookie值\""
    echo ""
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 检查图片文件
if [ -z "$IMAGE_PATH" ]; then
    echo -e "${YELLOW}⚠️  未提供图片路径，将创建一个测试图片${NC}"
    # 创建一个简单的测试图片（1x1 PNG）
    IMAGE_PATH="/tmp/test-upload-$(date +%s).png"
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$IMAGE_PATH"
    echo -e "${GREEN}✅ 创建测试图片: $IMAGE_PATH${NC}"
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}❌ 错误: 图片文件不存在: $IMAGE_PATH${NC}"
    exit 1
fi

# 获取文件信息
FILE_NAME=$(basename "$IMAGE_PATH")
FILE_SIZE=$(stat -f%z "$IMAGE_PATH" 2>/dev/null || stat -c%s "$IMAGE_PATH" 2>/dev/null)
FILE_TYPE=$(file -b --mime-type "$IMAGE_PATH" 2>/dev/null || echo "image/jpeg")

echo -e "${BLUE}📋 测试信息:${NC}"
echo "  API URL: $API_URL"
echo "  相册 ID: $ALBUM_ID"
echo "  文件路径: $IMAGE_PATH"
echo "  文件名: $FILE_NAME"
echo "  文件大小: $FILE_SIZE bytes ($(echo "scale=2; $FILE_SIZE/1024/1024" | bc) MB)"
echo "  文件类型: $FILE_TYPE"
echo ""

# 步骤 1: 获取上传凭证
echo -e "${BLUE}步骤 1: 获取上传凭证...${NC}"
CURL_HEADERS=(-H "Content-Type: application/json")
if [ -n "$AUTH_COOKIE" ]; then
    CURL_HEADERS+=(-H "Cookie: $AUTH_COOKIE")
fi

CRED_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/albums/$ALBUM_ID/upload" \
    "${CURL_HEADERS[@]}" \
    -d "{
        \"filename\": \"$FILE_NAME\",
        \"contentType\": \"$FILE_TYPE\",
        \"fileSize\": $FILE_SIZE
    }" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CRED_RESPONSE" | tail -n1)
CRED_BODY=$(echo "$CRED_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ 获取上传凭证失败 (HTTP $HTTP_CODE)${NC}"
    echo "响应: $CRED_BODY"
    exit 1
fi

echo -e "${GREEN}✅ 获取上传凭证成功${NC}"

# 解析响应
PHOTO_ID=$(echo "$CRED_BODY" | grep -o '"photoId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo "$CRED_BODY" | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
ORIGINAL_KEY=$(echo "$CRED_BODY" | grep -o '"originalKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PHOTO_ID" ] || [ -z "$UPLOAD_URL" ]; then
    echo -e "${RED}❌ 响应中缺少必要字段${NC}"
    echo "响应: $CRED_BODY"
    exit 1
fi

echo "  Photo ID: $PHOTO_ID"
echo "  Upload URL: ${UPLOAD_URL:0:80}..."
echo "  Original Key: $ORIGINAL_KEY"
echo ""

# 步骤 2: 上传文件
echo -e "${BLUE}步骤 2: 上传文件到 MinIO...${NC}"
UPLOAD_RESPONSE=$(curl -s -X PUT "$UPLOAD_URL" \
    -H "Content-Type: $FILE_TYPE" \
    --data-binary "@$IMAGE_PATH" \
    -w "\n%{http_code}")

UPLOAD_HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

if [ "$UPLOAD_HTTP_CODE" != "200" ] && [ "$UPLOAD_HTTP_CODE" != "204" ]; then
    echo -e "${RED}❌ 上传失败 (HTTP $UPLOAD_HTTP_CODE)${NC}"
    echo "响应: $UPLOAD_BODY"
    exit 1
fi

echo -e "${GREEN}✅ 文件上传成功${NC}"
echo ""

# 步骤 3: 触发处理
echo -e "${BLUE}步骤 3: 触发 Worker 处理...${NC}"
PROCESS_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/photos/process" \
    "${CURL_HEADERS[@]}" \
    -d "{
        \"photoId\": \"$PHOTO_ID\",
        \"albumId\": \"$ALBUM_ID\",
        \"originalKey\": \"$ORIGINAL_KEY\"
    }" \
    -w "\n%{http_code}")

PROCESS_HTTP_CODE=$(echo "$PROCESS_RESPONSE" | tail -n1)
PROCESS_BODY=$(echo "$PROCESS_RESPONSE" | sed '$d')

if [ "$PROCESS_HTTP_CODE" != "200" ]; then
    echo -e "${YELLOW}⚠️  触发处理失败 (HTTP $PROCESS_HTTP_CODE)${NC}"
    echo "响应: $PROCESS_BODY"
    echo "注意: 文件已上传，Worker 可能会自动检测并处理"
else
    echo -e "${GREEN}✅ 处理任务已提交${NC}"
fi
echo ""

# 步骤 4: 检查照片状态
echo -e "${BLUE}步骤 4: 检查照片状态...${NC}"
sleep 2  # 等待一下让数据库更新

STATUS_CURL_HEADERS=()
if [ -n "$AUTH_COOKIE" ]; then
    STATUS_CURL_HEADERS=(-H "Cookie: $AUTH_COOKIE")
fi
STATUS_RESPONSE=$(curl -s "$API_URL/api/admin/albums/$ALBUM_ID/photos?status=pending" \
    "${STATUS_CURL_HEADERS[@]}" \
    -w "\n%{http_code}")

STATUS_HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
STATUS_BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$STATUS_HTTP_CODE" = "200" ]; then
    PHOTO_FOUND=$(echo "$STATUS_BODY" | grep -o "\"id\":\"$PHOTO_ID\"" || echo "")
    if [ -n "$PHOTO_FOUND" ]; then
        echo -e "${GREEN}✅ 照片记录已创建 (状态: pending)${NC}"
    else
        echo -e "${YELLOW}⚠️  照片记录未找到（可能已处理完成）${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  无法检查照片状态 (HTTP $STATUS_HTTP_CODE)${NC}"
fi
echo ""

# 清理临时文件
if [[ "$IMAGE_PATH" == /tmp/test-upload-* ]]; then
    rm -f "$IMAGE_PATH"
    echo -e "${BLUE}🧹 清理临时文件${NC}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
echo "下一步:"
echo "  1. 在管理后台查看相册 $ALBUM_ID"
echo "  2. 检查照片是否出现在列表中"
echo "  3. 等待 Worker 处理完成（状态变为 completed）"
echo ""
