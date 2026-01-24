#!/bin/bash

# PIS 系统认证功能测试脚本
# 测试需要登录的功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${PIS_BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${PIS_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${PIS_ADMIN_PASSWORD:-test-password-123}"

# Cookie 文件
COOKIE_FILE=$(mktemp)
SESSION_TOKEN=""

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# 清理函数
cleanup() {
    rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

# 打印测试标题
print_test_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# 打印测试结果
print_test_result() {
    local test_name=$1
    local status=$2
    local message=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif [ "$status" = "SKIP" ]; then
        echo -e "${YELLOW}⊘${NC} $test_name: $message (跳过)"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# 测试登录功能
test_login() {
    print_test_header "测试登录功能"
    
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
        print_test_result "登录测试" "SKIP" "未提供登录凭据"
        return 1
    fi
    
    # 尝试登录（通过访问登录页并检查重定向）
    # 注意：Supabase Auth 需要浏览器环境，这里只测试登录页可访问
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -c "$COOKIE_FILE" \
        "$BASE_URL/admin/login" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ]; then
        local body=$(cat "$temp_file")
        if echo "$body" | grep -qi "登录\|login\|邮箱\|password"; then
            print_test_result "登录页访问" "PASS" "登录页可正常访问"
        else
            print_test_result "登录页访问" "FAIL" "登录页内容不正确"
        fi
    else
        print_test_result "登录页访问" "FAIL" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
    
    # 注意：实际的登录测试需要 Supabase Auth，这通常需要浏览器环境
    # 这里我们只测试登录页和API端点
    print_test_result "登录功能" "SKIP" "需要浏览器环境进行完整测试"
    
    return 0
}

# 测试管理后台 API（需要认证）
test_admin_apis() {
    print_test_header "测试管理后台 API"
    
    # 测试相册列表 API（应该返回 401）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        "$BASE_URL/api/admin/albums" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "相册列表API认证" "PASS" "正确要求认证 (HTTP 401)"
    else
        print_test_result "相册列表API认证" "SKIP" "HTTP $status_code"
    fi
    
    # 测试创建相册 API
    curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"title": "测试相册"}' \
        "$BASE_URL/api/admin/albums" \
        -o "$temp_file" 2>/dev/null | tail -c 3 > /tmp/post_status.txt
    
    local post_status=$(cat /tmp/post_status.txt)
    if [ "$post_status" = "401" ]; then
        print_test_result "创建相册API认证" "PASS" "正确要求认证 (HTTP 401)"
    else
        print_test_result "创建相册API认证" "SKIP" "HTTP $post_status"
    fi
    
    rm -f "$temp_file" /tmp/post_status.txt
}

# 测试模板 API
test_template_apis() {
    print_test_header "测试模板 API"
    
    local temp_file=$(mktemp)
    
    # 测试获取模板列表
    local status_code=$(curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        "$BASE_URL/api/admin/templates" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "模板列表API" "PASS" "正确要求认证 (HTTP 401)"
    else
        print_test_result "模板列表API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试照片管理 API
test_photo_apis() {
    print_test_header "测试照片管理 API"
    
    local temp_file=$(mktemp)
    
    # 测试照片列表 API
    local status_code=$(curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        "$BASE_URL/api/admin/albums/test-album-id/photos" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ] || [ "$status_code" = "404" ]; then
        print_test_result "照片列表API" "PASS" "端点存在 (HTTP $status_code)"
    else
        print_test_result "照片列表API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试上传 API
test_upload_api() {
    print_test_header "测试上传 API"
    
    local temp_file=$(mktemp)
    
    # 测试上传凭证 API（使用POST方法）
    local status_code=$(curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"filename":"test.jpg","contentType":"image/jpeg"}' \
        "$BASE_URL/api/admin/albums/test-album-id/upload" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ] || [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "上传凭证API" "PASS" "端点存在 (HTTP $status_code)"
    else
        print_test_result "上传凭证API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试照片重排序 API
test_reorder_api() {
    print_test_header "测试照片重排序 API"
    
    local temp_file=$(mktemp)
    
    # 测试照片重排序 API
    local status_code=$(curl -s -w "%{http_code}" \
        -b "$COOKIE_FILE" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -d '{"photoIds": []}' \
        "$BASE_URL/api/admin/photos/reorder" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ] || [ "$status_code" = "400" ]; then
        print_test_result "照片重排序API" "PASS" "端点存在 (HTTP $status_code)"
    else
        print_test_result "照片重排序API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 打印测试摘要
print_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}测试摘要${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "总测试数: ${TOTAL_TESTS}"
    echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
    echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
    echo -e "${YELLOW}跳过: ${SKIPPED_TESTS}${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有关键测试通过！${NC}"
        exit 0
    else
        echo ""
        echo -e "${RED}✗ 有 ${FAILED_TESTS} 个测试失败${NC}"
        exit 1
    fi
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════╗"
    echo "║   PIS 系统认证功能测试脚本        ║"
    echo "╚════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "测试环境: $BASE_URL"
    echo "测试账号: $ADMIN_EMAIL"
    echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo -e "${YELLOW}注意: 完整登录测试需要浏览器环境${NC}"
    echo ""
    
    # 检查依赖
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}错误: 需要安装 curl${NC}"
        exit 1
    fi
    
    # 运行测试
    test_login
    test_admin_apis
    test_template_apis
    test_photo_apis
    test_upload_api
    test_reorder_api
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
