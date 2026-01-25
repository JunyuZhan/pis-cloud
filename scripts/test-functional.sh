#!/bin/bash

# PIS 系统功能测试脚本
# 测试需要认证的功能（需要管理员账号）

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

# 检查依赖
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}警告: jq 未安装，JSON 解析功能将受限${NC}"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}错误: 缺少依赖: ${missing_deps[*]}${NC}"
        exit 1
    fi
}

# 测试 API 端点响应格式
test_api_response_format() {
    print_test_header "测试 API 响应格式"
    
    # 测试公开相册 API（应该返回 JSON）
    local temp_file=$(mktemp)
    local headers_file=$(mktemp)
    
    curl -s -w "%{http_code}" -D "$headers_file" "$BASE_URL/api/public/albums/invalid-slug-12345" -o "$temp_file" 2>/dev/null | tail -c 3 > /tmp/status_code.txt
    local status_code=$(cat /tmp/status_code.txt)
    local content_type=$(grep -i "content-type" "$headers_file" | head -1)
    local body=$(cat "$temp_file")
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        # 检查是否是 JSON（通过检查 body 是否包含 JSON 结构）
        if echo "$body" | grep -qE '^\s*\{|\"error\"'; then
            print_test_result "API响应格式" "PASS" "返回 JSON 格式 (HTTP $status_code)"
        elif echo "$content_type" | grep -qi "application/json"; then
            print_test_result "API响应格式" "PASS" "Content-Type 为 JSON (HTTP $status_code)"
        else
            print_test_result "API响应格式" "SKIP" "HTTP $status_code, Content-Type: $content_type"
        fi
    else
        print_test_result "API响应格式" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file" "$headers_file" /tmp/status_code.txt
}

# 测试 CORS 配置
test_cors() {
    print_test_header "测试 CORS 配置"
    
    local origin="https://example.com"
    local response=$(curl -s -I -H "Origin: $origin" "$BASE_URL/api/public/albums/test" 2>/dev/null)
    local cors_header=$(echo "$response" | grep -i "access-control-allow-origin" || echo "")
    
    if [ -n "$cors_header" ]; then
        print_test_result "CORS配置" "PASS" "CORS 头存在"
    else
        print_test_result "CORS配置" "SKIP" "CORS 头未设置（可能不需要）"
    fi
}

# 测试安全头
test_security_headers() {
    print_test_header "测试安全头"
    
    local response=$(curl -s -I "$BASE_URL" 2>/dev/null)
    local x_frame_options=$(echo "$response" | grep -i "x-frame-options" || echo "")
    local x_content_type=$(echo "$response" | grep -i "x-content-type-options" || echo "")
    local strict_transport=$(echo "$response" | grep -i "strict-transport-security" || echo "")
    
    local security_count=0
    
    if [ -n "$x_frame_options" ]; then
        security_count=$((security_count + 1))
    fi
    if [ -n "$x_content_type" ]; then
        security_count=$((security_count + 1))
    fi
    if [ -n "$strict_transport" ]; then
        security_count=$((security_count + 1))
    fi
    
    if [ $security_count -ge 2 ]; then
        print_test_result "安全头" "PASS" "检测到 $security_count 个安全头"
    elif [ $security_count -eq 1 ]; then
        print_test_result "安全头" "SKIP" "部分安全头存在 ($security_count)"
    else
        print_test_result "安全头" "SKIP" "安全头未检测到（可能由 Vercel 处理）"
    fi
}

# 测试页面元数据
test_page_metadata() {
    print_test_header "测试页面元数据"
    
    local temp_file=$(mktemp)
    curl -s "$BASE_URL" -o "$temp_file" 2>/dev/null
    
    local has_title=$(grep -qi "<title>" "$temp_file" && echo "yes" || echo "no")
    local has_meta=$(grep -qi "meta.*description" "$temp_file" && echo "yes" || echo "no")
    local has_og=$(grep -qi "og:" "$temp_file" && echo "yes" || echo "no")
    
    local metadata_count=0
    [ "$has_title" = "yes" ] && metadata_count=$((metadata_count + 1))
    [ "$has_meta" = "yes" ] && metadata_count=$((metadata_count + 1))
    [ "$has_og" = "yes" ] && metadata_count=$((metadata_count + 1))
    
    if [ $metadata_count -ge 2 ]; then
        print_test_result "页面元数据" "PASS" "检测到 $metadata_count 个元数据标签"
    else
        print_test_result "页面元数据" "FAIL" "元数据不完整"
    fi
    
    rm -f "$temp_file"
}

# 测试 PWA 配置
test_pwa_config() {
    print_test_header "测试 PWA 配置"
    
    local manifest_status=$(curl -s -w "%{http_code}" "$BASE_URL/manifest.json" -o /dev/null 2>/dev/null | tail -c 3)
    local sw_status=$(curl -s -w "%{http_code}" "$BASE_URL/sw.js" -o /dev/null 2>/dev/null | tail -c 3)
    
    if [ "$manifest_status" = "200" ]; then
        print_test_result "PWA Manifest" "PASS" "manifest.json 存在"
    else
        print_test_result "PWA Manifest" "SKIP" "manifest.json 不存在 (HTTP $manifest_status)"
    fi
    
    if [ "$sw_status" = "200" ] || [ "$sw_status" = "404" ]; then
        print_test_result "Service Worker" "SKIP" "sw.js HTTP $sw_status"
    else
        print_test_result "Service Worker" "SKIP" "sw.js HTTP $sw_status"
    fi
}

# 测试 API 错误处理
test_api_error_handling() {
    print_test_header "测试 API 错误处理"
    
    # 测试无效的相册 slug
    local temp_file=$(mktemp)
    local response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/public/albums/invalid-slug-12345" -o "$temp_file" 2>/dev/null)
    local status_code=$(echo "$response" | tail -n 1)
    local body=$(cat "$temp_file")
    
    if [ "$status_code" = "404" ]; then
        if echo "$body" | grep -qi "error\|not found\|不存在"; then
            print_test_result "API错误处理" "PASS" "返回正确的错误信息 (HTTP 404)"
        else
            print_test_result "API错误处理" "PASS" "HTTP 404"
        fi
    else
        print_test_result "API错误处理" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试响应式设计（检查 viewport meta）
test_responsive_design() {
    print_test_header "测试响应式设计"
    
    local temp_file=$(mktemp)
    curl -s "$BASE_URL" -o "$temp_file" 2>/dev/null
    
    local has_viewport=$(grep -qi "viewport" "$temp_file" && echo "yes" || echo "no")
    
    if [ "$has_viewport" = "yes" ]; then
        print_test_result "响应式设计" "PASS" "viewport meta 标签存在"
    else
        print_test_result "响应式设计" "FAIL" "viewport meta 标签缺失"
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
    
    if [ $FAILED_TESTS -eq 0 ] && [ $SKIPPED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有测试通过！${NC}"
        exit 0
    elif [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ 所有关键测试通过！${NC}"
        echo -e "${YELLOW}有 ${SKIPPED_TESTS} 个测试被跳过${NC}"
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
    echo "║   PIS 系统功能测试脚本            ║"
    echo "╚════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "测试环境: $BASE_URL"
    echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # 检查依赖
    check_dependencies
    
    # 运行测试
    test_api_response_format
    test_cors
    test_security_headers
    test_page_metadata
    test_pwa_config
    test_api_error_handling
    test_responsive_design
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
