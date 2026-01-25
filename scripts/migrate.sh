#!/bin/bash

# PIS 数据库迁移脚本
# 使用方法: bash scripts/migrate.sh [选项]
#
# 选项:
#   --all     执行所有迁移
#   --new     只执行新迁移（需要 migration_history 表）
#   --status  查看迁移状态
#   --help    显示帮助

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# 迁移目录
MIGRATION_DIR="database/migrations"

# 显示帮助
show_help() {
    echo ""
    echo "PIS 数据库迁移工具"
    echo ""
    echo "使用方法:"
    echo "  bash scripts/migrate.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --all       执行所有迁移（适合新安装）"
    echo "  --status    查看迁移文件列表"
    echo "  --supabase  在 Supabase SQL Editor 中执行的说明"
    echo "  --help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  bash scripts/migrate.sh --all      # 执行所有迁移"
    echo "  bash scripts/migrate.sh --status   # 查看迁移状态"
    echo ""
}

# 列出所有迁移文件
list_migrations() {
    echo ""
    echo -e "${CYAN}━━━ 数据库迁移文件 ━━━${NC}"
    echo ""
    
    local total_lines=0
    
    for file in "$MIGRATION_DIR"/*.sql; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            local lines=$(wc -l < "$file" | tr -d ' ')
            total_lines=$((total_lines + lines))
            echo -e "  ${GREEN}✓${NC} $filename (${lines} 行)"
        fi
    done
    
    echo ""
    echo -e "  总计: $(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ') 个文件, ${total_lines} 行 SQL"
    echo ""
}

# 生成合并的 SQL 文件
generate_full_schema() {
    local output_file="database/full_schema.sql"
    
    echo "-- PIS 完整数据库架构" > "$output_file"
    echo "-- 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')" >> "$output_file"
    echo "-- 包含所有迁移文件的合并内容" >> "$output_file"
    echo "" >> "$output_file"
    echo "-- ================================================" >> "$output_file"
    echo "-- 使用方法:" >> "$output_file"
    echo "-- 1. 在 Supabase Dashboard -> SQL Editor 中执行此文件" >> "$output_file"
    echo "-- 2. 或使用 psql: psql \$DATABASE_URL < database/full_schema.sql" >> "$output_file"
    echo "-- ================================================" >> "$output_file"
    echo "" >> "$output_file"
    
    for file in "$MIGRATION_DIR"/*.sql; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            echo "" >> "$output_file"
            echo "-- ================================================" >> "$output_file"
            echo "-- 迁移: $filename" >> "$output_file"
            echo "-- ================================================" >> "$output_file"
            echo "" >> "$output_file"
            cat "$file" >> "$output_file"
            echo "" >> "$output_file"
        fi
    done
    
    success "已生成 $output_file"
    echo ""
    echo "文件大小: $(wc -l < "$output_file") 行"
}

# Supabase 说明
supabase_instructions() {
    echo ""
    echo -e "${CYAN}━━━ Supabase 数据库迁移说明 ━━━${NC}"
    echo ""
    echo "由于 PIS 使用 Supabase 托管数据库，您需要在 Supabase Dashboard 执行迁移："
    echo ""
    echo "方式一：逐个执行（推荐用于升级）"
    echo "  1. 打开 Supabase Dashboard -> SQL Editor"
    echo "  2. 按顺序复制粘贴每个迁移文件内容并执行："
    echo ""
    
    for file in "$MIGRATION_DIR"/*.sql; do
        if [ -f "$file" ]; then
            echo "     - $(basename "$file")"
        fi
    done
    
    echo ""
    echo "方式二：一次性执行（推荐新安装）"
    echo "  1. 运行: bash scripts/migrate.sh --generate"
    echo "  2. 复制 database/full_schema.sql 内容"
    echo "  3. 在 Supabase SQL Editor 中粘贴并执行"
    echo ""
    echo "方式三：使用 psql（需要数据库连接字符串）"
    echo "  psql \"\$DATABASE_URL\" < database/full_schema.sql"
    echo ""
}

# 主逻辑
case "${1:-}" in
    --help|-h)
        show_help
        ;;
    --status|-s)
        list_migrations
        ;;
    --all|-a)
        info "生成完整数据库架构文件..."
        generate_full_schema
        supabase_instructions
        ;;
    --generate|-g)
        generate_full_schema
        ;;
    --supabase)
        supabase_instructions
        ;;
    "")
        show_help
        ;;
    *)
        error "未知选项: $1"
        show_help
        exit 1
        ;;
esac
