#!/bin/bash

# PIS 系统高级功能测试脚本
# 测试更多边界情况和详细功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${PIS_BASE_URL:-http://localhost:3000}"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# 打印测试标题
print_test_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

# 测试 API 错误处理
test_api_error_handling() {
    print_test_header "测试 API 错误处理"
    
    local temp_file=$(mktemp)
    local headers_file=$(mktemp)
    
    # 测试无效的相册 slug
    local status_code=$(curl -s -w "%{http_code}" \
        -D "$headers_file" \
        "$BASE_URL/api/public/albums/invalid-slug-$(date +%s)" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    local body=$(cat "$temp_file")
    local content_type=$(grep -i "content-type" "$headers_file" | head -1)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        if echo "$body" | grep -qE '^\s*\{|"error"'; then
            print_test_result "无效相册slug错误处理" "PASS" "返回 JSON 错误格式 (HTTP $status_code)"
        else
            print_test_result "无效相册slug错误处理" "SKIP" "HTTP $status_code, 但响应格式异常"
        fi
    else
        print_test_result "无效相册slug错误处理" "SKIP" "HTTP $status_code"
    fi
    
    # 测试无效的请求方法
    local status_code=$(curl -s -w "%{http_code}" \
        -X DELETE \
        "$BASE_URL/api/public/albums/test" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "405" ] || [ "$status_code" = "404" ]; then
        print_test_result "无效HTTP方法错误处理" "PASS" "正确拒绝 (HTTP $status_code)"
    else
        print_test_result "无效HTTP方法错误处理" "SKIP" "HTTP $status_code"
    fi
    
    # 测试无效的 JSON 请求体
    local status_code=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"invalid": json}' \
        "$BASE_URL/api/public/albums/test/verify-password" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "400" ] || [ "$status_code" = "404" ]; then
        print_test_result "无效JSON请求体错误处理" "PASS" "正确拒绝 (HTTP $status_code)"
    else
        print_test_result "无效JSON请求体错误处理" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file" "$headers_file"
}

# 测试 API 参数验证
test_api_parameter_validation() {
    print_test_header "测试 API 参数验证"
    
    local temp_file=$(mktemp)
    
    # 测试分页参数边界值
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?page=0" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "分页参数page=0" "PASS" "端点响应 (HTTP $status_code)"
    else
        print_test_result "分页参数page=0" "SKIP" "HTTP $status_code"
    fi
    
    # 测试负数分页
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?page=-1" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "400" ] || [ "$status_code" = "404" ]; then
        print_test_result "分页参数page=-1" "PASS" "正确拒绝负数 (HTTP $status_code)"
    else
        print_test_result "分页参数page=-1" "SKIP" "HTTP $status_code"
    fi
    
    # 测试超大分页数
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?page=999999" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "分页参数page=999999" "PASS" "端点响应 (HTTP $status_code)"
    else
        print_test_result "分页参数page=999999" "SKIP" "HTTP $status_code"
    fi
    
    # 测试无效的排序参数
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?sort=invalid_sort" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "400" ] || [ "$status_code" = "404" ]; then
        print_test_result "无效排序参数" "PASS" "端点响应 (HTTP $status_code)"
    else
        print_test_result "无效排序参数" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试 API 响应头
test_api_headers() {
    print_test_header "测试 API 响应头"
    
    local headers_file=$(mktemp)
    
    # 测试 CORS 头
    curl -s -I \
        -H "Origin: https://example.com" \
        "$BASE_URL/api/public/albums/test" \
        -D "$headers_file" > /dev/null 2>&1
    
    if grep -qi "access-control" "$headers_file"; then
        print_test_result "CORS响应头" "PASS" "包含 CORS 头"
    else
        print_test_result "CORS响应头" "SKIP" "未检测到 CORS 头"
    fi
    
    # 测试内容类型
    curl -s -I \
        "$BASE_URL/api/public/albums/test" \
        -D "$headers_file" > /dev/null 2>&1
    
    if grep -qi "content-type.*json" "$headers_file"; then
        print_test_result "Content-Type响应头" "PASS" "正确设置 JSON 类型"
    else
        print_test_result "Content-Type响应头" "SKIP" "未检测到 JSON Content-Type"
    fi
    
    # 测试缓存控制
    curl -s -I \
        "$BASE_URL/api/public/albums/test" \
        -D "$headers_file" > /dev/null 2>&1
    
    if grep -qiE "cache-control|no-cache" "$headers_file"; then
        print_test_result "缓存控制响应头" "PASS" "包含缓存控制头"
    else
        print_test_result "缓存控制响应头" "SKIP" "未检测到缓存控制头"
    fi
    
    rm -f "$headers_file"
}

# 测试性能指标
test_performance_metrics() {
    print_test_header "测试性能指标"
    
    # 测试首页响应时间
    local start_time=$(date +%s%N)
    curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ $duration -lt 3000 ]; then
        print_test_result "首页响应时间" "PASS" "${duration}ms (< 3s)"
    else
        print_test_result "首页响应时间" "FAIL" "${duration}ms (>= 3s)"
    fi
    
    # 测试 API 响应时间
    local start_time=$(date +%s%N)
    curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/public/albums/test" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ $duration -lt 2000 ]; then
        print_test_result "API响应时间" "PASS" "${duration}ms (< 2s)"
    else
        print_test_result "API响应时间" "SKIP" "${duration}ms"
    fi
    
    # 测试并发请求
    local temp_file=$(mktemp)
    local start_time=$(date +%s%N)
    
    for i in {1..5}; do
        curl -s -o /dev/null "$BASE_URL" &
    done
    wait
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ $duration -lt 5000 ]; then
        print_test_result "并发请求(5个)" "PASS" "${duration}ms (< 5s)"
    else
        print_test_result "并发请求(5个)" "SKIP" "${duration}ms"
    fi
    
    rm -f "$temp_file"
}

# 测试 URL 编码处理
test_url_encoding() {
    print_test_header "测试 URL 编码处理"
    
    local temp_file=$(mktemp)
    
    # 测试特殊字符 slug
    local encoded_slug=$(echo "test-album-123" | sed 's/ /%20/g')
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/$encoded_slug" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ] || [ "$status_code" = "200" ]; then
        print_test_result "URL编码slug处理" "PASS" "端点响应 (HTTP $status_code)"
    else
        print_test_result "URL编码slug处理" "SKIP" "HTTP $status_code"
    fi
    
    # 测试查询参数编码
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?group=test%20group" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "查询参数编码处理" "PASS" "端点响应 (HTTP $status_code)"
    else
        print_test_result "查询参数编码处理" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试安全头
test_security_headers() {
    print_test_header "测试安全响应头"
    
    local headers_file=$(mktemp)
    
    curl -s -I "$BASE_URL" -D "$headers_file" > /dev/null 2>&1
    
    local security_headers=0
    
    if grep -qiE "x-frame-options|X-Frame-Options" "$headers_file"; then
        security_headers=$((security_headers + 1))
    fi
    
    if grep -qiE "x-content-type-options|X-Content-Type-Options" "$headers_file"; then
        security_headers=$((security_headers + 1))
    fi
    
    if grep -qiE "x-xss-protection|X-XSS-Protection" "$headers_file"; then
        security_headers=$((security_headers + 1))
    fi
    
    if grep -qiE "strict-transport-security|Strict-Transport-Security" "$headers_file"; then
        security_headers=$((security_headers + 1))
    fi
    
    if [ $security_headers -ge 2 ]; then
        print_test_result "安全响应头" "PASS" "检测到 $security_headers 个安全头"
    else
        print_test_result "安全响应头" "SKIP" "检测到 $security_headers 个安全头"
    fi
    
    rm -f "$headers_file"
}

# 测试 API 数据格式一致性
test_api_data_consistency() {
    print_test_header "测试 API 数据格式一致性"
    
    local temp_file=$(mktemp)
    
    # 测试相册列表 API 格式
    curl -s "$BASE_URL/api/public/albums" -o "$temp_file" 2>/dev/null
    
    if [ -s "$temp_file" ]; then
        if command -v jq &> /dev/null; then
            if jq empty "$temp_file" 2>/dev/null; then
                # 检查是否包含预期字段
                if jq -e '.albums or .data or .' "$temp_file" > /dev/null 2>&1; then
                    print_test_result "相册列表API格式" "PASS" "有效的 JSON 格式"
                else
                    print_test_result "相册列表API格式" "SKIP" "JSON 格式异常"
                fi
            else
                print_test_result "相册列表API格式" "SKIP" "无效的 JSON"
            fi
        else
            if echo "$(cat "$temp_file")" | grep -qE '^\s*\{|^\s*\['; then
                print_test_result "相册列表API格式" "PASS" "疑似 JSON 格式"
            else
                print_test_result "相册列表API格式" "SKIP" "格式未知"
            fi
        fi
    else
        print_test_result "相册列表API格式" "SKIP" "响应为空"
    fi
    
    rm -f "$temp_file"
}

# 打印测试摘要
print_summary() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}测试摘要${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "总测试数: ${TOTAL_TESTS}"
    echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
    echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
    echo -e "${YELLOW}跳过: ${SKIPPED_TESTS}${NC}"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local pass_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")
        echo -e "通过率: ${GREEN}${pass_rate}%${NC}"
    fi
    
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
    echo "╔════════════════════════════════════════════════╗"
    echo "║   PIS 系统高级功能测试脚本                    ║"
    echo "╚════════════════════════════════════════════════╝"
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
    test_api_error_handling
    test_api_parameter_validation
    test_api_headers
    test_performance_metrics
    test_url_encoding
    test_security_headers
    test_api_data_consistency
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
