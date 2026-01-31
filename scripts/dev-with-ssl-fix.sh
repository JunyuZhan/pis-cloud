#!/bin/bash

# 🔧 开发服务器启动脚本（自动修复 SSL 证书问题）
# 使用方法: ./scripts/dev-with-ssl-fix.sh 或 pnpm dev:ssl-fix

set -e

echo "🔧 检查并修复 SSL 证书配置..."
echo ""

# 检测 macOS 系统证书
if [[ "$OSTYPE" == "darwin"* ]]; then
    # 方法1: 使用系统证书
    if [ -f "/etc/ssl/cert.pem" ]; then
        export NODE_EXTRA_CA_CERTS="/etc/ssl/cert.pem"
        echo "✅ 使用系统证书: /etc/ssl/cert.pem"
    # 方法2: 使用 Homebrew 证书
    elif command -v brew &> /dev/null && [ -f "$(brew --prefix)/etc/ca-certificates/cert.pem" ]; then
        export NODE_EXTRA_CA_CERTS="$(brew --prefix)/etc/ca-certificates/cert.pem"
        echo "✅ 使用 Homebrew 证书"
    # 方法3: 开发环境临时禁用 SSL 验证（仅开发）
    else
        echo "⚠️  未找到系统证书，开发环境将禁用 SSL 验证"
        echo "   注意：这仅适用于开发环境，生产环境请配置正确的证书"
        export NODE_TLS_REJECT_UNAUTHORIZED=0
    fi
else
    echo "ℹ️  非 macOS 系统，跳过 SSL 证书修复"
fi

echo ""
echo "🚀 启动开发服务器..."
echo ""

# 启动开发服务器
exec pnpm dev "$@"
