#!/bin/bash

# ============================================
# PIS 部署配置文件示例
# 
# 使用方法:
# 1. 复制为 deploy-config.sh
# 2. 填写配置
# 3. source deploy-config.sh && bash scripts/deploy.sh <IP> <用户>
# ============================================

# Supabase 配置（使用 Supabase 时必填）
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# GitHub 配置（可选）
export GITHUB_REPO="https://github.com/junyuzhan/pis.git"
export GITHUB_BRANCH="main"

# 部署目录（可选）
export DEPLOY_DIR="/opt/pis"
