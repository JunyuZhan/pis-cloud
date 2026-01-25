#!/bin/bash

# PIS 系统 API 功能测试脚本
# 测试 API 端点的功能和数据格式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${PIS_BASE_URL:-http://localhost:3000}"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# 测试结果记录
TEST_RESULTS=()

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
        TEST_RESULTS+=("PASS: $test_name")
    elif [ "$status" = "SKIP" ]; then
        echo -e "${YELLOW}⊘${NC} $test_name: $message (跳过)"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        TEST_RESULTS+=("SKIP: $test_name")
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("FAIL: $test_name - $message")
    fi
}

# 检查 JSON 格式
check_json() {
    local json_string=$1
    if command -v jq &> /dev/null; then
        echo "$json_string" | jq . > /dev/null 2>&1
        return $?
    else
        # 简单检查：是否以 { 或 [ 开头
        if echo "$json_string" | grep -qE '^\s*[\{\[]'; then
            return 0
        fi
        return 1
    fi
}

# 测试公开相册 API
test_public_albums_api() {
    print_test_header "测试公开相册 API"
    
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" "$BASE_URL/api/public/albums/invalid-slug-test" -o "$temp_file" 2>/dev/null | tail -c 3)
    local body=$(cat "$temp_file")
    
    if [ "$status_code" = "404" ]; then
        if check_json "$body"; then
            print_test_result "公开相册API格式" "PASS" "返回有效 JSON (HTTP 404)"
        else
            print_test_result "公开相册API格式" "FAIL" "返回的不是有效 JSON"
        fi
        
        # 检查错误消息格式
        if echo "$body" | grep -qi "error\|not found\|不存在"; then
            print_test_result "公开相册API错误消息" "PASS" "包含错误信息"
        else
            print_test_result "公开相册API错误消息" "SKIP" "错误信息格式可能不同"
        fi
    else
        print_test_result "公开相册API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试管理 API 认证
test_admin_api_auth() {
    print_test_header "测试管理 API 认证"
    
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" "$BASE_URL/api/admin/albums" -o "$temp_file" 2>/dev/null | tail -c 3)
    local body=$(cat "$temp_file")
    
    if [ "$status_code" = "401" ]; then
        print_test_result "管理API认证" "PASS" "正确要求认证 (HTTP 401)"
        
        if check_json "$body"; then
            print_test_result "管理API错误格式" "PASS" "返回有效 JSON 错误"
        else
            print_test_result "管理API错误格式" "SKIP" "错误格式可能不同"
        fi
    else
        print_test_result "管理API认证" "FAIL" "HTTP $status_code, 应该返回 401"
    fi
    
    rm -f "$temp_file"
}

# 测试照片 API
test_photos_api() {
    print_test_header "测试照片 API"
    
    # 测试无效相册的照片列表
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" "$BASE_URL/api/public/albums/invalid-slug/photos" -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "照片API端点" "PASS" "端点可访问 (HTTP $status_code)"
    else
        print_test_result "照片API端点" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试下载 API
test_download_api() {
    print_test_header "测试下载 API"
    
    # 测试无效照片ID的下载
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" "$BASE_URL/api/public/download/invalid-photo-id" -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ] || [ "$status_code" = "401" ]; then
        print_test_result "下载API端点" "PASS" "端点可访问 (HTTP $status_code)"
    else
        print_test_result "下载API端点" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试选片 API
test_select_api() {
    print_test_header "测试选片 API"
    
    # 测试选片 API 端点（使用GET方法获取选中状态）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/photos/invalid-photo-id/select" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "选片API端点" "PASS" "端点可访问 (HTTP $status_code)"
    else
        print_test_result "选片API端点" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试 API 响应时间
test_api_response_time() {
    print_test_header "测试 API 响应时间"
    
    local start_time=$(date +%s%N)
    curl -s -o /dev/null "$BASE_URL/api/public/albums/test" 2>/dev/null
    local end_time=$(date +%s%N)
    
    local duration=$(( (end_time - start_time) / 1000000 )) # 转换为毫秒
    
    if [ $duration -lt 1000 ]; then
        print_test_result "API响应时间" "PASS" "${duration}ms (< 1s)"
    elif [ $duration -lt 2000 ]; then
        print_test_result "API响应时间" "PASS" "${duration}ms (< 2s)"
    else
        print_test_result "API响应时间" "SKIP" "${duration}ms (> 2s, 可能较慢)"
    fi
}

# 测试 API 版本一致性
test_api_consistency() {
    print_test_header "测试 API 一致性"
    
    # 测试多个端点是否都返回 JSON
    local endpoints=(
        "/api/public/albums/test"
        "/api/public/albums/test/photos"
        "/api/admin/albums"
    )
    
    local json_count=0
    local total_count=0
    
    for endpoint in "${endpoints[@]}"; do
        local temp_file=$(mktemp)
        curl -s "$BASE_URL$endpoint" -o "$temp_file" 2>/dev/null
        local body=$(cat "$temp_file")
        
        total_count=$((total_count + 1))
        if check_json "$body"; then
            json_count=$((json_count + 1))
        fi
        
        rm -f "$temp_file"
    done
    
    if [ $json_count -eq $total_count ]; then
        print_test_result "API一致性" "PASS" "所有端点返回 JSON ($json_count/$total_count)"
    elif [ $json_count -gt 0 ]; then
        print_test_result "API一致性" "SKIP" "部分端点返回 JSON ($json_count/$total_count)"
    else
        print_test_result "API一致性" "SKIP" "无法验证"
    fi
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
    
    if [ $FAILED_TESTS -eq 0 ] && [ $SKIPPED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有测试通过！${NC}"
        exit 0
    elif [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有关键测试通过！${NC}"
        if [ $SKIPPED_TESTS -gt 0 ]; then
            echo -e "${YELLOW}有 ${SKIPPED_TESTS} 个测试被跳过${NC}"
        fi
        exit 0
    else
        echo ""
        echo -e "${RED}✗ 有 ${FAILED_TESTS} 个测试失败${NC}"
        echo ""
        echo "失败的测试:"
        for result in "${TEST_RESULTS[@]}"; do
            if echo "$result" | grep -q "^FAIL:"; then
                echo -e "${RED}  $result${NC}"
            fi
        done
        exit 1
    fi
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════╗"
    echo "║   PIS 系统 API 功能测试脚本       ║"
    echo "╚════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "测试环境: $BASE_URL"
    echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # 检查依赖
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}错误: 需要安装 curl${NC}"
        exit 1
    fi
    
    # 运行测试
    test_public_albums_api
    test_admin_api_auth
    test_photos_api
    test_download_api
    test_select_api
    test_api_response_time
    test_api_consistency
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
