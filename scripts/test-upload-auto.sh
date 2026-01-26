#!/bin/bash

# 自动登录并测试上传功能
# 用法: ./scripts/test-upload-auto.sh [album_id] [image_path]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${NEXT_PUBLIC_APP_URL:-https://pic.albertzhan.top}"
EMAIL="${1:-junyuzhan@outlook.com}"
PASSWORD="${2:-Zjy-1314}"
ALBUM_ID="${3:-}"
IMAGE_PATH="${4:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  自动上传测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 步骤 1: 登录获取 Cookie
echo -e "${BLUE}[1/5] 登录获取认证 Cookie...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/test-upload-cookies.txt -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$EMAIL\",
        \"password\": \"$PASSWORD\"
    }" \
    -w "\n%{http_code}")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$LOGIN_HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ 登录失败 (HTTP $LOGIN_HTTP_CODE)${NC}"
    echo "响应: $LOGIN_BODY"
    exit 1
fi

# 提取 Cookie
AUTH_COOKIE=$(grep -i "sb-" /tmp/test-upload-cookies.txt | awk '{print $6"="$7}' | tr '\n' ';' | sed 's/;$//')

if [ -z "$AUTH_COOKIE" ]; then
    echo -e "${RED}❌ 无法获取认证 Cookie${NC}"
    echo "登录响应: $LOGIN_BODY"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 步骤 2: 获取相册列表
echo -e "${BLUE}[2/5] 获取相册列表...${NC}"
ALBUMS_RESPONSE=$(curl -s -b /tmp/test-upload-cookies.txt "$API_URL/api/admin/albums?limit=10" \
    -w "\n%{http_code}")

ALBUMS_HTTP_CODE=$(echo "$ALBUMS_RESPONSE" | tail -n1)
ALBUMS_BODY=$(echo "$ALBUMS_RESPONSE" | sed '$d')

if [ "$ALBUMS_HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ 获取相册列表失败 (HTTP $ALBUMS_HTTP_CODE)${NC}"
    echo "响应: $ALBUMS_BODY"
    exit 1
fi

# 解析第一个相册 ID
if command -v jq &> /dev/null; then
    ALBUM_ID_FROM_LIST=$(echo "$ALBUMS_BODY" | jq -r '.albums[0].id' 2>/dev/null || echo "")
    ALBUM_TITLE=$(echo "$ALBUMS_BODY" | jq -r '.albums[0].title' 2>/dev/null || echo "")
else
    ALBUM_ID_FROM_LIST=$(echo "$ALBUMS_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    ALBUM_TITLE=$(echo "$ALBUMS_BODY" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "未知相册")
fi

if [ -z "$ALBUM_ID" ]; then
    if [ -z "$ALBUM_ID_FROM_LIST" ]; then
        echo -e "${RED}❌ 未找到相册，请先创建一个相册${NC}"
        exit 1
    fi
    ALBUM_ID="$ALBUM_ID_FROM_LIST"
fi

echo -e "${GREEN}✅ 找到相册: ${ALBUM_TITLE:-未知} (ID: $ALBUM_ID)${NC}"
echo ""

# 步骤 3: 准备测试图片
if [ -z "$IMAGE_PATH" ]; then
    echo -e "${YELLOW}⚠️  未提供图片路径，将创建一个测试图片${NC}"
    IMAGE_PATH="/tmp/test-upload-$(date +%s).png"
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$IMAGE_PATH"
    echo -e "${GREEN}✅ 创建测试图片: $IMAGE_PATH${NC}"
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}❌ 图片文件不存在: $IMAGE_PATH${NC}"
    exit 1
fi

FILE_NAME=$(basename "$IMAGE_PATH")
FILE_SIZE=$(stat -f%z "$IMAGE_PATH" 2>/dev/null || stat -c%s "$IMAGE_PATH" 2>/dev/null)
FILE_TYPE=$(file -b --mime-type "$IMAGE_PATH" 2>/dev/null || echo "image/jpeg")

echo -e "${BLUE}📋 测试信息:${NC}"
echo "  相册: ${ALBUM_TITLE:-未知} ($ALBUM_ID)"
echo "  文件: $FILE_NAME ($(echo "scale=2; $FILE_SIZE/1024/1024" | bc) MB)"
echo ""

# 步骤 4: 获取上传凭证
echo -e "${BLUE}[3/5] 获取上传凭证...${NC}"
CRED_RESPONSE=$(curl -s -b /tmp/test-upload-cookies.txt -X POST "$API_URL/api/admin/albums/$ALBUM_ID/upload" \
    -H "Content-Type: application/json" \
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
    rm -f /tmp/test-upload-cookies.txt
    exit 1
fi

PHOTO_ID=$(echo "$CRED_BODY" | grep -o '"photoId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo "$CRED_BODY" | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
ORIGINAL_KEY=$(echo "$CRED_BODY" | grep -o '"originalKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PHOTO_ID" ] || [ -z "$UPLOAD_URL" ]; then
    echo -e "${RED}❌ 响应中缺少必要字段${NC}"
    echo "响应: $CRED_BODY"
    rm -f /tmp/test-upload-cookies.txt
    exit 1
fi

echo -e "${GREEN}✅ 成功 (Photo ID: $PHOTO_ID)${NC}"

# 步骤 5: 上传文件
echo -e "${BLUE}[4/5] 上传文件到 MinIO...${NC}"
UPLOAD_RESPONSE=$(curl -s -X PUT "$UPLOAD_URL" \
    -H "Content-Type: $FILE_TYPE" \
    --data-binary "@$IMAGE_PATH" \
    -w "\n%{http_code}")

UPLOAD_HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)

if [ "$UPLOAD_HTTP_CODE" != "200" ] && [ "$UPLOAD_HTTP_CODE" != "204" ]; then
    echo -e "${RED}❌ 上传失败 (HTTP $UPLOAD_HTTP_CODE)${NC}"
    rm -f /tmp/test-upload-cookies.txt
    exit 1
fi

echo -e "${GREEN}✅ 成功${NC}"

# 步骤 6: 触发处理
echo -e "${BLUE}[5/5] 触发 Worker 处理...${NC}"
PROCESS_RESPONSE=$(curl -s -b /tmp/test-upload-cookies.txt -X POST "$API_URL/api/admin/photos/process" \
    -H "Content-Type: application/json" \
    -d "{
        \"photoId\": \"$PHOTO_ID\",
        \"albumId\": \"$ALBUM_ID\",
        \"originalKey\": \"$ORIGINAL_KEY\"
    }" \
    -w "\n%{http_code}")

PROCESS_HTTP_CODE=$(echo "$PROCESS_RESPONSE" | tail -n1)

if [ "$PROCESS_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 成功${NC}"
else
    echo -e "${YELLOW}⚠️  失败 (HTTP $PROCESS_HTTP_CODE)，Worker 可能会自动检测${NC}"
fi

# 步骤 7: 检查状态
echo ""
echo -e "${BLUE}检查照片状态...${NC}"
sleep 3  # 等待 Worker 处理

# 先检查 pending 状态
PENDING_RESPONSE=$(curl -s -b /tmp/test-upload-cookies.txt "$API_URL/api/admin/albums/$ALBUM_ID/photos?status=pending" \
    -w "\n%{http_code}")

PENDING_HTTP_CODE=$(echo "$PENDING_RESPONSE" | tail -n1)
PENDING_BODY=$(echo "$PENDING_RESPONSE" | sed '$d')

# 再检查 completed 状态
COMPLETED_RESPONSE=$(curl -s -b /tmp/test-upload-cookies.txt "$API_URL/api/admin/albums/$ALBUM_ID/photos?status=completed&limit=10" \
    -w "\n%{http_code}")

COMPLETED_HTTP_CODE=$(echo "$COMPLETED_RESPONSE" | tail -n1)
COMPLETED_BODY=$(echo "$COMPLETED_RESPONSE" | sed '$d')

if [ "$PENDING_HTTP_CODE" = "200" ] || [ "$COMPLETED_HTTP_CODE" = "200" ]; then
    PHOTO_FOUND_PENDING=$(echo "$PENDING_BODY" | grep -o "\"id\":\"$PHOTO_ID\"" || echo "")
    PHOTO_FOUND_COMPLETED=$(echo "$COMPLETED_BODY" | grep -o "\"id\":\"$PHOTO_ID\"" || echo "")
    
    if [ -n "$PHOTO_FOUND_PENDING" ]; then
        echo -e "${GREEN}✅ 照片记录已创建 (状态: pending)${NC}"
    elif [ -n "$PHOTO_FOUND_COMPLETED" ]; then
        echo -e "${GREEN}✅ 照片记录已创建并处理完成 (状态: completed)${NC}"
    else
        echo -e "${YELLOW}⚠️  照片记录未找到（可能正在处理中）${NC}"
        echo "   Photo ID: $PHOTO_ID"
    fi
else
    echo -e "${YELLOW}⚠️  无法检查照片状态 (HTTP $PENDING_HTTP_CODE / $COMPLETED_HTTP_CODE)${NC}"
fi

# 清理
rm -f /tmp/test-upload-cookies.txt
if [[ "$IMAGE_PATH" == /tmp/test-upload-* ]]; then
    rm -f "$IMAGE_PATH"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
echo "查看结果: https://pic.albertzhan.top/admin/albums/$ALBUM_ID"
echo ""
