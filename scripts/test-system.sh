#!/bin/bash

# PIS 系统自动化测试脚本
# 测试生产环境功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${PIS_BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${PIS_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${PIS_ADMIN_PASSWORD:-}"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("FAIL: $test_name - $message")
    fi
}

# HTTP 请求函数
http_get() {
    local url=$1
    local headers=$2
    local temp_file=$(mktemp)
    local status_file=$(mktemp)
    
    # 获取响应体和状态码
    curl -s -w "%{http_code}" -H "$headers" "$url" -o "$temp_file" 2>/dev/null | tail -c 3 > "$status_file"
    local status_code=$(cat "$status_file")
    
    # 输出响应体和状态码（状态码在最后一行）
    cat "$temp_file"
    echo "$status_code"
    
    rm -f "$temp_file" "$status_file"
}

http_post() {
    local url=$1
    local data=$2
    local headers=$3
    local temp_file=$(mktemp)
    curl -s -w "\n%{http_code}" -X POST -H "$headers" -d "$data" "$url" -o "$temp_file" 2>/dev/null
    cat "$temp_file"
    rm -f "$temp_file"
}

# 测试 1: 首页可访问
test_homepage() {
    print_test_header "测试 1: 首页可访问性"
    
    local temp_body=$(mktemp)
    local temp_status=$(mktemp)
    
    curl -s -w "%{http_code}" "$BASE_URL" -o "$temp_body" 2>/dev/null | tail -c 3 > "$temp_status"
    local status_code=$(cat "$temp_status")
    
    if [ "$status_code" = "200" ]; then
        print_test_result "首页访问" "PASS" "HTTP $status_code"
    else
        print_test_result "首页访问" "FAIL" "HTTP $status_code"
    fi
    
    rm -f "$temp_body" "$temp_status"
}

# 测试 2: 管理后台登录页可访问
test_admin_login_page() {
    print_test_header "测试 2: 管理后台登录页"
    
    local temp_body=$(mktemp)
    local temp_status=$(mktemp)
    
    curl -s -w "%{http_code}" "$BASE_URL/admin/login" -o "$temp_body" 2>/dev/null | tail -c 3 > "$temp_status"
    local status_code=$(cat "$temp_status")
    local body=$(cat "$temp_body")
    
    if [ "$status_code" = "200" ]; then
        if echo "$body" | grep -qi "PIS\|登录\|管理"; then
            print_test_result "登录页访问" "PASS" "HTTP $status_code, 页面内容正确"
        else
            print_test_result "登录页访问" "FAIL" "HTTP $status_code, 但页面内容可能不正确"
        fi
    else
        print_test_result "登录页访问" "FAIL" "HTTP $status_code"
    fi
    
    rm -f "$temp_body" "$temp_status"
}

# 测试 3: 未登录访问管理后台被重定向
test_admin_redirect() {
    print_test_header "测试 3: 访问控制"
    
    local temp_status=$(mktemp)
    curl -s -w "%{http_code}" "$BASE_URL/admin" -o /dev/null 2>/dev/null | tail -c 3 > "$temp_status"
    local status_code=$(cat "$temp_status")
    rm -f "$temp_status"
    
    if [ "$status_code" = "307" ] || [ "$status_code" = "302" ]; then
        print_test_result "未登录重定向" "PASS" "HTTP $status_code, 正确重定向到登录页"
    else
        print_test_result "未登录重定向" "FAIL" "HTTP $status_code, 应该重定向"
    fi
}

# 测试 4: API 端点可访问性
test_api_endpoints() {
    print_test_header "测试 4: API 端点可访问性"
    
    # 测试公开 API
    local temp_status=$(mktemp)
    curl -s -w "%{http_code}" "$BASE_URL/api/public/albums/test" -o /dev/null 2>/dev/null | tail -c 3 > "$temp_status"
    local public_status=$(cat "$temp_status")
    
    if [ "$public_status" = "404" ] || [ "$public_status" = "200" ] || [ "$public_status" = "400" ]; then
        print_test_result "公开相册API" "PASS" "端点可访问 (HTTP $public_status)"
    else
        print_test_result "公开相册API" "FAIL" "HTTP $public_status"
    fi
    
    # 测试管理 API (应该返回 401)
    curl -s -w "%{http_code}" "$BASE_URL/api/admin/albums" -o /dev/null 2>/dev/null | tail -c 3 > "$temp_status"
    local admin_status=$(cat "$temp_status")
    
    if [ "$admin_status" = "401" ]; then
        print_test_result "管理API认证" "PASS" "正确要求认证 (HTTP 401)"
    else
        print_test_result "管理API认证" "FAIL" "HTTP $admin_status, 应该返回 401"
    fi
    
    rm -f "$temp_status"
}

# 测试 5: 静态资源加载
test_static_resources() {
    print_test_header "测试 5: 静态资源加载"
    
    # 测试 favicon
    local temp_status=$(mktemp)
    curl -s -w "%{http_code}" "$BASE_URL/favicon.ico" -o /dev/null 2>/dev/null | tail -c 3 > "$temp_status"
    local favicon_status=$(cat "$temp_status")
    
    if [ "$favicon_status" = "200" ] || [ "$favicon_status" = "404" ]; then
        print_test_result "Favicon" "PASS" "HTTP $favicon_status"
    else
        print_test_result "Favicon" "FAIL" "HTTP $favicon_status"
    fi
    
    rm -f "$temp_status"
}

# 测试 6: 响应时间测试
test_response_time() {
    print_test_header "测试 6: 响应时间"
    
    local start_time=$(date +%s%N)
    curl -s -o /dev/null "$BASE_URL" 2>/dev/null
    local end_time=$(date +%s%N)
    
    local duration=$(( (end_time - start_time) / 1000000 )) # 转换为毫秒
    
    if [ $duration -lt 2000 ]; then
        print_test_result "首页响应时间" "PASS" "${duration}ms (< 2s)"
    elif [ $duration -lt 5000 ]; then
        print_test_result "首页响应时间" "PASS" "${duration}ms (< 5s, 可接受)"
    else
        print_test_result "首页响应时间" "FAIL" "${duration}ms (> 5s, 太慢)"
    fi
}

# 测试 7: HTTPS/SSL 测试
test_ssl() {
    print_test_header "测试 7: SSL/HTTPS"
    
    if echo "$BASE_URL" | grep -q "^https://"; then
        local hostname=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
        local ssl_info=$(echo | openssl s_client -connect "${hostname}:443" -servername "$hostname" 2>/dev/null | grep -A 5 "Certificate chain" || echo "")
        
        if [ -n "$ssl_info" ]; then
            print_test_result "SSL证书" "PASS" "HTTPS 连接正常"
        else
            print_test_result "SSL证书" "FAIL" "无法验证 SSL 证书"
        fi
    else
        print_test_result "SSL证书" "SKIP" "使用 HTTP，跳过 SSL 测试"
    fi
}

# 测试 8: 错误页面处理
test_error_pages() {
    print_test_header "测试 8: 错误页面处理"
    
    # 测试 404
    local temp_status=$(mktemp)
    curl -s -w "%{http_code}" "$BASE_URL/nonexistent-page-12345" -o /dev/null 2>/dev/null | tail -c 3 > "$temp_status"
    local not_found_status=$(cat "$temp_status")
    
    if [ "$not_found_status" = "404" ]; then
        print_test_result "404错误处理" "PASS" "HTTP 404"
    else
        print_test_result "404错误处理" "FAIL" "HTTP $not_found_status, 应该返回 404"
    fi
    
    rm -f "$temp_status"
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
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有测试通过！${NC}"
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
    echo "║   PIS 系统自动化测试脚本          ║"
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
    test_homepage
    test_admin_login_page
    test_admin_redirect
    test_api_endpoints
    test_static_resources
    test_response_time
    test_ssl
    test_error_pages
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
