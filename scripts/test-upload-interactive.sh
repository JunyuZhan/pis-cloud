#!/bin/bash

# 交互式上传测试脚本
# 用法: ./scripts/test-upload-interactive.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${NEXT_PUBLIC_APP_URL:-https://pic.albertzhan.top}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  交互式上传测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 获取 Cookie
echo -e "${YELLOW}请提供认证 Cookie:${NC}"
echo "（从浏览器开发者工具中复制，格式: sb-xxx-auth-token=xxx; sb-xxx-access-token=xxx）"
read -p "Cookie: " AUTH_COOKIE

if [ -z "$AUTH_COOKIE" ]; then
    echo -e "${RED}❌ Cookie 不能为空${NC}"
    exit 1
fi

# 获取相册列表
echo ""
echo -e "${BLUE}正在获取相册列表...${NC}"
ALBUMS_RESPONSE=$(curl -s "$API_URL/api/admin/albums?limit=10" \
    -H "Cookie: $AUTH_COOKIE" \
    -w "\n%{http_code}")

ALBUMS_HTTP_CODE=$(echo "$ALBUMS_RESPONSE" | tail -n1)
ALBUMS_BODY=$(echo "$ALBUMS_RESPONSE" | sed '$d')

if [ "$ALBUMS_HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ 获取相册列表失败 (HTTP $ALBUMS_HTTP_CODE)${NC}"
    echo "响应: $ALBUMS_BODY"
    exit 1
fi

# 显示相册列表
echo -e "${GREEN}✅ 找到以下相册:${NC}"
ALBUM_IDS=()
ALBUM_TITLES=()
while IFS= read -r line; do
    if [[ $line =~ \"id\":\"([^\"]+)\" ]]; then
        ALBUM_IDS+=("${BASH_REMATCH[1]}")
    fi
    if [[ $line =~ \"title\":\"([^\"]+)\" ]]; then
        ALBUM_TITLES+=("${BASH_REMATCH[1]}")
    fi
done < <(echo "$ALBUMS_BODY" | grep -E '"id"|"title"')

if [ ${#ALBUM_IDS[@]} -eq 0 ]; then
    echo -e "${RED}❌ 未找到相册，请先创建一个相册${NC}"
    exit 1
fi

for i in "${!ALBUM_IDS[@]}"; do
    echo "  $((i+1)). ${ALBUM_TITLES[$i]} (${ALBUM_IDS[$i]})"
done

echo ""
read -p "选择相册编号 (1-${#ALBUM_IDS[@]}): " SELECTION
SELECTION=$((SELECTION - 1))

if [ $SELECTION -lt 0 ] || [ $SELECTION -ge ${#ALBUM_IDS[@]} ]; then
    echo -e "${RED}❌ 无效的选择${NC}"
    exit 1
fi

ALBUM_ID="${ALBUM_IDS[$SELECTION]}"
ALBUM_TITLE="${ALBUM_TITLES[$SELECTION]}"

echo -e "${GREEN}✅ 已选择: $ALBUM_TITLE${NC}"
echo ""

# 获取图片路径
read -p "图片文件路径 (留空使用测试图片): " IMAGE_PATH

if [ -z "$IMAGE_PATH" ]; then
    IMAGE_PATH="/tmp/test-upload-$(date +%s).png"
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$IMAGE_PATH"
    echo -e "${GREEN}✅ 创建测试图片: $IMAGE_PATH${NC}"
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}❌ 图片文件不存在: $IMAGE_PATH${NC}"
    exit 1
fi

# 获取文件信息
FILE_NAME=$(basename "$IMAGE_PATH")
FILE_SIZE=$(stat -f%z "$IMAGE_PATH" 2>/dev/null || stat -c%s "$IMAGE_PATH" 2>/dev/null)
FILE_TYPE=$(file -b --mime-type "$IMAGE_PATH" 2>/dev/null || echo "image/jpeg")

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  开始测试上传${NC}"
echo -e "${BLUE}========================================${NC}"
echo "  相册: $ALBUM_TITLE"
echo "  文件: $FILE_NAME ($(echo "scale=2; $FILE_SIZE/1024/1024" | bc) MB)"
echo ""

# 步骤 1: 获取上传凭证
echo -e "${BLUE}[1/4] 获取上传凭证...${NC}"
CRED_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/albums/$ALBUM_ID/upload" \
    -H "Content-Type: application/json" \
    -H "Cookie: $AUTH_COOKIE" \
    -d "{
        \"filename\": \"$FILE_NAME\",
        \"contentType\": \"$FILE_TYPE\",
        \"fileSize\": $FILE_SIZE
    }" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CRED_RESPONSE" | tail -n1)
CRED_BODY=$(echo "$CRED_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ 失败 (HTTP $HTTP_CODE)${NC}"
    echo "$CRED_BODY"
    exit 1
fi

PHOTO_ID=$(echo "$CRED_BODY" | grep -o '"photoId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo "$CRED_BODY" | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
ORIGINAL_KEY=$(echo "$CRED_BODY" | grep -o '"originalKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PHOTO_ID" ] || [ -z "$UPLOAD_URL" ]; then
    echo -e "${RED}❌ 响应中缺少必要字段${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 成功 (Photo ID: $PHOTO_ID)${NC}"

# 步骤 2: 上传文件
echo -e "${BLUE}[2/4] 上传文件...${NC}"
UPLOAD_RESPONSE=$(curl -s -X PUT "$UPLOAD_URL" \
    -H "Content-Type: $FILE_TYPE" \
    --data-binary "@$IMAGE_PATH" \
    -w "\n%{http_code}")

UPLOAD_HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)

if [ "$UPLOAD_HTTP_CODE" != "200" ] && [ "$UPLOAD_HTTP_CODE" != "204" ]; then
    echo -e "${RED}❌ 失败 (HTTP $UPLOAD_HTTP_CODE)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 成功${NC}"

# 步骤 3: 触发处理
echo -e "${BLUE}[3/4] 触发 Worker 处理...${NC}"
PROCESS_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/photos/process" \
    -H "Content-Type: application/json" \
    -H "Cookie: $AUTH_COOKIE" \
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

# 步骤 4: 检查状态
echo -e "${BLUE}[4/4] 检查照片状态...${NC}"
sleep 2

STATUS_RESPONSE=$(curl -s "$API_URL/api/admin/albums/$ALBUM_ID/photos?status=pending" \
    -H "Cookie: $AUTH_COOKIE" \
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
fi

# 清理临时文件
if [[ "$IMAGE_PATH" == /tmp/test-upload-* ]]; then
    rm -f "$IMAGE_PATH"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
echo "查看结果: https://pic.albertzhan.top/admin/albums/$ALBUM_ID"
echo ""
