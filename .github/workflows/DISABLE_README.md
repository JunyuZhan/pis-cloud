# GitHub Actions 计费问题解决方案

## 当前问题

GitHub Actions 显示错误：
> "The job was not started because recent account payments have failed or your spending limit needs to be increased"

## 解决方案

### 方案 1: 修复账户付款（推荐）

1. **访问 GitHub 设置**
   - 直接访问：https://github.com/settings/billing
   - 或：GitHub → Settings → Billing & plans

2. **检查付款方式**
   - 确认付款方式（信用卡/PayPal）是否有效
   - 如果过期，更新付款信息

3. **调整支出限制**
   - 在 "Spending limits" 部分
   - 设置合适的限制（例如 $10/月）
   - 或暂时设置为 "Unlimited"（如果有有效付款方式）

4. **检查使用情况**
   - 查看 "Actions & Packages" 使用情况
   - 免费账户每月有 2000 分钟
   - 如果超过，需要升级到付费计划

### 方案 2: 临时禁用 GitHub Actions

如果暂时不需要 CI/CD，可以禁用：

**方法 A: 在 GitHub 网页禁用**
1. 进入仓库 Settings → Actions → General
2. 选择 "Disable Actions" 或 "Allow select actions"
3. 保存

**方法 B: 重命名 workflow 文件**
```bash
# 重命名文件，GitHub 就不会运行它们
mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled
mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disabled
```

**方法 C: 删除 workflow 文件**
```bash
git rm .github/workflows/ci.yml
git rm .github/workflows/deploy.yml
git commit -m "chore: 临时禁用 GitHub Actions"
git push
```

### 方案 3: 使用自托管 Runner（高级）

如果有自己的服务器，可以设置自托管 runner：
- 参考：https://docs.github.com/en/actions/hosting-your-own-runners

### 方案 4: 优化 Workflow 减少消耗

已实施的优化：
- ✅ 添加了 `timeout-minutes` 限制运行时间
- ✅ 添加了 `paths-ignore` 减少不必要的运行
- ✅ 使用缓存加速构建

## 免费额度说明

GitHub Actions 免费账户：
- **公开仓库**: 无限分钟
- **私有仓库**: 每月 2000 分钟

如果仓库是私有的且超过免费额度，需要：
1. 修复付款方式
2. 或升级到付费计划
3. 或将仓库设为公开（如果允许）

## 推荐操作

1. **立即**: 访问 https://github.com/settings/billing 检查付款方式
2. **如果不需要 CI/CD**: 临时禁用 Actions（方法 B 或 C）
3. **如果需要 CI/CD**: 修复付款方式后，workflow 会自动恢复运行
