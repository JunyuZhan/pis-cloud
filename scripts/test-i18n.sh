#!/bin/bash

# i18n 功能测试脚本
# 测试多语言配置是否正确

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🌍 测试多语言配置..."
echo ""

ERRORS=0
WARNINGS=0

# 1. 检查 next-intl 是否安装
echo "1️⃣  检查 next-intl 依赖..."
cd apps/web
if [ -f "node_modules/next-intl/package.json" ] || pnpm list next-intl 2>/dev/null | grep -q "next-intl"; then
    echo -e "${GREEN}✅ next-intl 已安装${NC}"
    VERSION=$(grep '"next-intl"' package.json | head -1 | sed 's/.*"next-intl": "\([^"]*\)".*/\1/')
    echo "   版本: $VERSION"
else
    echo -e "${YELLOW}⚠️  next-intl 可能未安装${NC}"
    echo "  运行: cd apps/web && pnpm install"
    WARNINGS=$((WARNINGS + 1))
fi
cd ../..
echo ""

# 2. 检查翻译文件
echo "2️⃣  检查翻译文件..."
if [ -f "apps/web/src/messages/en.json" ]; then
    echo -e "${GREEN}✅ 英文翻译文件存在${NC}"
else
    echo -e "${RED}❌ 英文翻译文件不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "apps/web/src/messages/zh-CN.json" ]; then
    echo -e "${GREEN}✅ 中文翻译文件存在${NC}"
else
    echo -e "${RED}❌ 中文翻译文件不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. 检查翻译文件格式
echo "3️⃣  检查翻译文件格式..."
if command -v jq &> /dev/null; then
    if jq empty apps/web/src/messages/en.json 2>/dev/null; then
        echo -e "${GREEN}✅ 英文翻译文件格式正确${NC}"
    else
        echo -e "${RED}❌ 英文翻译文件格式错误${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if jq empty apps/web/src/messages/zh-CN.json 2>/dev/null; then
        echo -e "${GREEN}✅ 中文翻译文件格式正确${NC}"
    else
        echo -e "${RED}❌ 中文翻译文件格式错误${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  jq 未安装，跳过 JSON 格式检查${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 4. 检查 i18n 配置文件
echo "4️⃣  检查 i18n 配置文件..."
if [ -f "apps/web/src/i18n/config.ts" ]; then
    echo -e "${GREEN}✅ i18n/config.ts 存在${NC}"
else
    echo -e "${RED}❌ i18n/config.ts 不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "apps/web/src/i18n/request.ts" ]; then
    echo -e "${GREEN}✅ i18n/request.ts 存在${NC}"
else
    echo -e "${RED}❌ i18n/request.ts 不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "apps/web/src/i18n/routing.ts" ]; then
    echo -e "${GREEN}✅ i18n/routing.ts 存在${NC}"
else
    echo -e "${RED}❌ i18n/routing.ts 不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. 检查组件
echo "5️⃣  检查组件..."
if [ -f "apps/web/src/components/ui/language-switcher.tsx" ]; then
    echo -e "${GREEN}✅ LanguageSwitcher 组件存在${NC}"
else
    echo -e "${RED}❌ LanguageSwitcher 组件不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "apps/web/src/components/providers.tsx" ]; then
    if grep -q "NextIntlClientProvider" apps/web/src/components/providers.tsx; then
        echo -e "${GREEN}✅ Providers 包含 NextIntlClientProvider${NC}"
    else
        echo -e "${RED}❌ Providers 未包含 NextIntlClientProvider${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Providers 组件不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. 检查 middleware
echo "6️⃣  检查 middleware..."
if [ -f "apps/web/src/middleware.ts" ]; then
    if grep -q "NEXT_LOCALE" apps/web/src/middleware.ts; then
        echo -e "${GREEN}✅ Middleware 包含语言处理${NC}"
    else
        echo -e "${YELLOW}⚠️  Middleware 可能未配置语言处理${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Middleware 不存在${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. 检查翻译 key 一致性
echo "7️⃣  检查翻译 key 一致性..."
if command -v jq &> /dev/null; then
    EN_KEYS=$(jq -r 'paths(scalars) as $p | $p | join(".")' apps/web/src/messages/en.json | sort)
    ZH_KEYS=$(jq -r 'paths(scalars) as $p | $p | join(".")' apps/web/src/messages/zh-CN.json | sort)
    
    if [ "$EN_KEYS" = "$ZH_KEYS" ]; then
        echo -e "${GREEN}✅ 翻译 key 一致${NC}"
    else
        echo -e "${YELLOW}⚠️  翻译 key 不一致${NC}"
        echo "   英文 key 数量: $(echo "$EN_KEYS" | wc -l)"
        echo "   中文 key 数量: $(echo "$ZH_KEYS" | wc -l)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  jq 未安装，跳过 key 一致性检查${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 8. 检查测试页面
echo "8️⃣  检查测试页面..."
if [ -f "apps/web/src/app/test-i18n/page.tsx" ]; then
    echo -e "${GREEN}✅ 测试页面存在${NC}"
    echo "   访问: http://localhost:3000/test-i18n"
else
    echo -e "${YELLOW}⚠️  测试页面不存在${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！多语言配置正确。${NC}"
    echo ""
    echo "下一步："
    echo "  1. 启动开发服务器: ${BLUE}cd apps/web && pnpm dev${NC}"
    echo "  2. 访问测试页面: ${BLUE}http://localhost:3000/test-i18n${NC}"
    echo "  3. 测试语言切换功能"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $WARNINGS 个警告，但配置基本正确。${NC}"
    echo ""
    echo "可以继续测试，但建议修复警告。"
    exit 0
else
    echo -e "${RED}❌ 发现 $ERRORS 个错误和 $WARNINGS 个警告！${NC}"
    echo ""
    echo "请修复错误后再测试。"
    exit 1
fi
