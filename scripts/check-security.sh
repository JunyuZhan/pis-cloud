#!/bin/bash

# 🔒 PIS 项目安全检查脚本
# 用于在提交代码前检查是否有敏感信息泄露风险

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 开始安全检查..."
echo ""

ERRORS=0
WARNINGS=0

# 1. 检查敏感文件是否被 Git 跟踪
echo "1️⃣  检查敏感文件..."
SENSITIVE_FILES=$(git ls-files 2>/dev/null | grep -E "\.env$|\.env\.local$|\.key$|\.pem$|\.p12$|id_rsa$|id_dsa$" || true)

if [ -n "$SENSITIVE_FILES" ]; then
    echo -e "${RED}❌ 发现敏感文件被 Git 跟踪：${NC}"
    echo "$SENSITIVE_FILES"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有敏感文件被 Git 跟踪${NC}"
fi
echo ""

# 2. 检查 Git 历史中是否有敏感文件
echo "2️⃣  检查 Git 历史..."
HISTORY_FILES=$(git log --all --full-history --source --name-only --format="" 2>/dev/null | grep -E "\.env\.local$|\.env$" | sort -u || true)

if [ -n "$HISTORY_FILES" ]; then
    echo -e "${YELLOW}⚠️  警告：Git 历史中发现敏感文件：${NC}"
    echo "$HISTORY_FILES"
    echo -e "${YELLOW}建议：使用 git-filter-repo 从历史中删除这些文件${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ Git 历史中没有敏感文件${NC}"
fi
echo ""

# 3. 检查代码中是否有硬编码的 JWT tokens（排除 .env.local 文件）
echo "3️⃣  检查硬编码的 JWT tokens..."
JWT_TOKENS=$(grep -r "eyJ[A-Za-z0-9_-]\{50,\}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="*.md" --exclude="*.example" --exclude=".env.local" --exclude=".env" . 2>/dev/null || true)

if [ -n "$JWT_TOKENS" ]; then
    echo -e "${RED}❌ 发现可能的硬编码 JWT token：${NC}"
    echo "$JWT_TOKENS" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的 JWT tokens${NC}"
fi
echo ""

# 4. 检查 AWS Access Keys
echo "4️⃣  检查 AWS Access Keys..."
AWS_KEYS=$(grep -r "AKIA[0-9A-Z]\{16\}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="*.md" --exclude="*.example" . 2>/dev/null || true)

if [ -n "$AWS_KEYS" ]; then
    echo -e "${RED}❌ 发现可能的 AWS Access Key：${NC}"
    echo "$AWS_KEYS"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现 AWS Access Keys${NC}"
fi
echo ""

# 5. 检查硬编码的密码（排除测试脚本中的默认值和 UI 代码）
echo "5️⃣  检查硬编码的密码..."
PASSWORDS=$(grep -ri "password.*=.*['\"][^'\"]\{8,\}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.shared --exclude="*.md" --exclude="*.example" --exclude="*.test.*" --exclude=".env.local" --exclude=".env" --exclude="*.pyc" --exclude="*.csv" . 2>/dev/null | grep -v "password123" | grep -v "minioadmin" | grep -v "your-" | grep -v "PIS_ADMIN_PASSWORD" | grep -v "test-password" | grep -v "show.*Password" | grep -v "showConfirmPassword" | grep -v "type.*password" | grep -v "input.*password" | grep -v "Eye" || true)

if [ -n "$PASSWORDS" ]; then
    echo -e "${YELLOW}⚠️  警告：发现可能的硬编码密码：${NC}"
    echo "$PASSWORDS" | head -5
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的密码${NC}"
fi
echo ""

# 6. 检查 .env.example 文件是否包含真实密钥
echo "6️⃣  检查 .env.example 文件..."
if [ -f ".env.example" ]; then
    REAL_KEYS=$(grep -E "(hapkufkiavhrxxcuzptm|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZS)" .env.example 2>/dev/null || true)
    if [ -n "$REAL_KEYS" ]; then
        echo -e "${RED}❌ .env.example 包含真实密钥！${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ .env.example 只包含占位符${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  警告：未找到 .env.example 文件${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 7. 检查 .gitignore 配置
echo "7️⃣  检查 .gitignore 配置..."
if [ -f ".gitignore" ]; then
    if grep -q "\.env" .gitignore && grep -q "\.env\.local" .gitignore; then
        echo -e "${GREEN}✅ .gitignore 正确配置了环境变量文件${NC}"
    else
        echo -e "${RED}❌ .gitignore 缺少环境变量文件配置${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ 未找到 .gitignore 文件${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 安全检查通过！可以安全地公开仓库。${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $WARNINGS 个警告，建议修复后再公开仓库。${NC}"
    exit 0
else
    echo -e "${RED}❌ 发现 $ERRORS 个错误和 $WARNINGS 个警告！${NC}"
    echo -e "${RED}请修复这些问题后再公开仓库。${NC}"
    echo ""
    echo "查看 SECURITY_CHECK.md 了解如何修复这些问题。"
    exit 1
fi
