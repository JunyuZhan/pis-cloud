# GitHub Actions Workflows

## 计费说明

GitHub Actions 免费账户每月有 **2000 分钟**的免费额度。

### 如果遇到计费问题

1. **检查账户设置**
   - 前往 GitHub Settings → Billing & plans
   - 检查付款方式是否有效
   - 确认是否超过免费额度

2. **优化 Workflow**
   - 已添加 `timeout-minutes` 限制运行时间
   - 已添加 `paths-ignore` 减少不必要的运行
   - 使用缓存减少构建时间

3. **临时禁用 Workflow**
   - 如果暂时不需要 CI/CD，可以在 GitHub 仓库设置中禁用 Actions
   - 或者删除 `.github/workflows/` 目录中的文件

### Workflow 说明

- **ci.yml**: 代码检查和测试（PR 和 push 时运行）
- **deploy.yml**: 自动部署（仅在 main 分支 push 时运行）

### 减少消耗的建议

1. 只在代码更改时运行（已配置 `paths-ignore`）
2. 使用缓存加速构建（已配置）
3. 设置超时时间（已配置）
4. 考虑使用自托管 runner（如果可用）
