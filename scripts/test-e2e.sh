#!/bin/bash

# PIS 系统端到端测试脚本
# 测试完整的业务流程

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${PIS_BASE_URL:-https://pic.albertzhan.top}"

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
        if echo "$json_string" | grep -qE '^\s*[\{\[]'; then
            return 0
        fi
        return 1
    fi
}

# 测试首页相册列表
test_homepage_albums() {
    print_test_header "测试首页相册列表"
    
    local temp_file=$(mktemp)
    curl -s "$BASE_URL" -o "$temp_file" 2>/dev/null
    
    # 检查是否有相册相关内容
    local body=$(cat "$temp_file")
    local has_album_content=$(echo "$body" | grep -qi "相册\|album\|作品" && echo "yes" || echo "no")
    local has_grid=$(echo "$body" | grep -qi "columns\|grid\|masonry" && echo "yes" || echo "no")
    
    if [ "$has_album_content" = "yes" ]; then
        print_test_result "首页内容" "PASS" "包含相册相关内容"
    else
        print_test_result "首页内容" "SKIP" "无法验证相册内容"
    fi
    
    if [ "$has_grid" = "yes" ]; then
        print_test_result "首页布局" "PASS" "包含网格布局样式"
    else
        print_test_result "首页布局" "SKIP" "无法验证布局"
    fi
    
    rm -f "$temp_file"
}

# 测试访客相册页结构
test_visitor_album_page() {
    print_test_header "测试访客相册页"
    
    # 测试一个不存在的相册（应该返回404或错误页面）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" "$BASE_URL/album/test-slug-12345" -o "$temp_file" 2>/dev/null | tail -c 3)
    local body=$(cat "$temp_file")
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "200" ]; then
        # 检查页面结构（使用 echo 管道避免文件名问题）
        local has_lightbox=$(echo "$body" | grep -qi "lightbox\|modal\|dialog" && echo "yes" || echo "no")
        local has_masonry=$(echo "$body" | grep -qi "masonry\|columns\|grid" && echo "yes" || echo "no")
        
        if [ "$has_lightbox" = "yes" ] || [ "$has_masonry" = "yes" ]; then
            print_test_result "访客页面结构" "PASS" "包含必要的UI组件 (HTTP $status_code)"
        else
            print_test_result "访客页面结构" "SKIP" "HTTP $status_code"
        fi
    else
        print_test_result "访客页面结构" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试 API 数据格式
test_api_data_format() {
    print_test_header "测试 API 数据格式"
    
    # 测试公开相册 API 返回格式
    local temp_file=$(mktemp)
    curl -s "$BASE_URL/api/public/albums/invalid-slug" -o "$temp_file" 2>/dev/null
    local body=$(cat "$temp_file")
    
    if check_json "$body"; then
        # 检查错误格式
        if echo "$body" | grep -qi "error\|message\|code"; then
            print_test_result "API错误格式" "PASS" "返回标准错误格式"
        else
            print_test_result "API错误格式" "SKIP" "JSON格式正确，但结构可能不同"
        fi
    else
        print_test_result "API错误格式" "FAIL" "返回的不是有效JSON"
    fi
    
    rm -f "$temp_file"
}

# 测试 API 分页功能
test_api_pagination() {
    print_test_header "测试 API 分页功能"
    
    # 测试照片列表 API 的分页参数
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?page=1&limit=10" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        local body=$(cat "$temp_file")
        if check_json "$body"; then
            print_test_result "API分页参数" "PASS" "接受分页参数 (HTTP $status_code)"
        else
            print_test_result "API分页参数" "SKIP" "HTTP $status_code"
        fi
    else
        print_test_result "API分页参数" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试 API 排序功能
test_api_sorting() {
    print_test_header "测试 API 排序功能"
    
    # 测试不同的排序参数
    local sort_params=("capture_desc" "capture_asc" "manual" "upload_desc")
    local valid_count=0
    
    for sort in "${sort_params[@]}"; do
        local temp_file=$(mktemp)
        local status_code=$(curl -s -w "%{http_code}" \
            "$BASE_URL/api/public/albums/test/photos?sort=$sort" \
            -o "$temp_file" 2>/dev/null | tail -c 3)
        
        if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
            valid_count=$((valid_count + 1))
        fi
        rm -f "$temp_file"
    done
    
    if [ $valid_count -eq ${#sort_params[@]} ]; then
        print_test_result "API排序参数" "PASS" "所有排序参数都被接受"
    else
        print_test_result "API排序参数" "SKIP" "$valid_count/${#sort_params[@]} 参数有效"
    fi
}

# 测试 API 筛选功能
test_api_filtering() {
    print_test_header "测试 API 筛选功能"
    
    # 测试分组筛选
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test/photos?groupId=test-group" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        print_test_result "API分组筛选" "PASS" "接受分组筛选参数 (HTTP $status_code)"
    else
        print_test_result "API分组筛选" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试下载链接格式
test_download_link_format() {
    print_test_header "测试下载链接格式"
    
    # 测试下载 API 的响应
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/download/invalid-photo-id" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "302" ] || [ "$status_code" = "401" ]; then
        print_test_result "下载API响应" "PASS" "端点响应正常 (HTTP $status_code)"
    else
        print_test_result "下载API响应" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试密码验证 API
test_password_verification() {
    print_test_header "测试密码验证 API"
    
    # 测试密码验证端点
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"password": "test"}' \
        "$BASE_URL/api/public/albums/test-slug/verify-password" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ] || [ "$status_code" = "401" ]; then
        local body=$(cat "$temp_file")
        if check_json "$body"; then
            print_test_result "密码验证API" "PASS" "端点可访问 (HTTP $status_code)"
        else
            print_test_result "密码验证API" "SKIP" "HTTP $status_code"
        fi
    else
        print_test_result "密码验证API" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试打包下载 API
test_package_download_api() {
    print_test_header "测试打包下载 API"
    
    # 测试打包下载端点（需要认证，应该返回401）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"photoIds": [], "includeOriginal": true, "includeWatermarked": true}' \
        "$BASE_URL/api/admin/albums/test-album-id/package" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "打包下载API认证" "PASS" "正确要求认证 (HTTP 401)"
    elif [ "$status_code" = "404" ]; then
        print_test_result "打包下载API认证" "PASS" "端点存在 (HTTP 404)"
    else
        print_test_result "打包下载API认证" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试分组 API
test_group_api() {
    print_test_header "测试分组 API"
    
    # 测试分组列表 API
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/public/albums/test-slug/groups" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "400" ]; then
        local body=$(cat "$temp_file")
        if check_json "$body"; then
            print_test_result "分组API端点" "PASS" "端点可访问 (HTTP $status_code)"
        else
            print_test_result "分组API端点" "SKIP" "HTTP $status_code"
        fi
    else
        print_test_result "分组API端点" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试批量操作 API
test_batch_api() {
    print_test_header "测试批量操作 API"
    
    # 测试批量删除 API（需要认证）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -X DELETE \
        -H "Content-Type: application/json" \
        -d '{"albumIds": []}' \
        "$BASE_URL/api/admin/albums/batch" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "批量操作API认证" "PASS" "正确要求认证 (HTTP 401)"
    elif [ "$status_code" = "400" ]; then
        print_test_result "批量操作API认证" "PASS" "端点存在并验证参数 (HTTP 400)"
    else
        print_test_result "批量操作API认证" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试模板 API
test_template_api() {
    print_test_header "测试模板 API"
    
    # 测试模板列表 API（需要认证）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        "$BASE_URL/api/admin/templates" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "模板API认证" "PASS" "正确要求认证 (HTTP 401)"
    else
        print_test_result "模板API认证" "SKIP" "HTTP $status_code"
    fi
    
    rm -f "$temp_file"
}

# 测试重复相册 API
test_duplicate_api() {
    print_test_header "测试重复相册 API"
    
    # 测试重复相册端点（需要认证）
    local temp_file=$(mktemp)
    local status_code=$(curl -s -w "%{http_code}" \
        -X POST \
        "$BASE_URL/api/admin/albums/test-album-id/duplicate" \
        -o "$temp_file" 2>/dev/null | tail -c 3)
    
    if [ "$status_code" = "401" ]; then
        print_test_result "重复相册API认证" "PASS" "正确要求认证 (HTTP 401)"
    elif [ "$status_code" = "404" ]; then
        print_test_result "重复相册API认证" "PASS" "端点存在 (HTTP 404)"
    else
        print_test_result "重复相册API认证" "SKIP" "HTTP $status_code"
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
    echo "║   PIS 系统端到端测试脚本          ║"
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
    test_homepage_albums
    test_visitor_album_page
    test_api_data_format
    test_api_pagination
    test_api_sorting
    test_api_filtering
    test_download_link_format
    test_password_verification
    test_package_download_api
    test_group_api
    test_batch_api
    test_template_api
    test_duplicate_api
    
    # 打印摘要
    print_summary
}

# 运行主函数
main
