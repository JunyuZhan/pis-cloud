#!/bin/bash

# 🔧 PIS SSL 证书修复脚本
# 解决 macOS 上 "unable to get local issuer certificate" 错误

set -e

echo "🔧 修复 Node.js SSL 证书问题..."
echo ""

# 检测操作系统
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  此脚本仅适用于 macOS"
    exit 1
fi

# 方法1: 使用系统证书（推荐）
if [ -f "/etc/ssl/cert.pem" ]; then
    echo "✅ 找到系统证书: /etc/ssl/cert.pem"
    export NODE_EXTRA_CA_CERTS="/etc/ssl/cert.pem"
elif [ -f "/usr/local/etc/openssl/cert.pem" ]; then
    echo "✅ 找到系统证书: /usr/local/etc/openssl/cert.pem"
    export NODE_EXTRA_CA_CERTS="/usr/local/etc/openssl/cert.pem"
else
    echo "⚠️  未找到系统证书文件"
fi

# 方法2: 使用 Homebrew 安装的证书（如果使用 Homebrew）
if command -v brew &> /dev/null; then
    BREW_SSL_CERT=$(brew --prefix)/etc/ca-certificates/cert.pem
    if [ -f "$BREW_SSL_CERT" ]; then
        echo "✅ 找到 Homebrew 证书: $BREW_SSL_CERT"
        export NODE_EXTRA_CA_CERTS="$BREW_SSL_CERT"
    fi
fi

# 方法3: 下载并使用 Mozilla CA 证书（备选）
if [ -z "$NODE_EXTRA_CA_CERTS" ] || [ ! -f "$NODE_EXTRA_CA_CERTS" ]; then
    echo "📥 下载 Mozilla CA 证书..."
    mkdir -p ~/.certs
    curl -o ~/.certs/cacert.pem https://curl.se/ca/cacert.pem 2>/dev/null || {
        echo "⚠️  无法下载证书，将使用开发模式（禁用 SSL 验证）"
        export NODE_TLS_REJECT_UNAUTHORIZED=0
    }
    
    if [ -f ~/.certs/cacert.pem ]; then
        export NODE_EXTRA_CA_CERTS="$HOME/.certs/cacert.pem"
        echo "✅ 已下载证书到: ~/.certs/cacert.pem"
    fi
fi

echo ""
echo "📝 将以下环境变量添加到你的 shell 配置文件中:"
echo ""
echo "   export NODE_EXTRA_CA_CERTS=\"$NODE_EXTRA_CA_CERTS\""
echo ""
echo "   或者添加到 ~/.zshrc 或 ~/.bash_profile:"
echo "   echo 'export NODE_EXTRA_CA_CERTS=\"$NODE_EXTRA_CA_CERTS\"' >> ~/.zshrc"
echo ""
echo "⚠️  如果上述方法都不行，可以在开发环境中临时禁用 SSL 验证:"
echo "   export NODE_TLS_REJECT_UNAUTHORIZED=0"
echo ""
