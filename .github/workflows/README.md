# GitHub Actions Workflows

## Workflow 说明

| 文件 | 触发条件 | 说明 |
|------|----------|------|
| `ci.yml` | PR 和 push | 代码检查、构建测试 |
| `deploy.yml` | main 分支 push | 自动部署到 Vercel |

## 优化配置

已配置以下优化以减少 Actions 消耗：

- `timeout-minutes`: 限制运行时间
- `paths-ignore`: 跳过文档更改
- 缓存: pnpm 依赖缓存

## 禁用 Workflow

如果暂时不需要 CI/CD：

```bash
# 方法 1: 在 GitHub 设置中禁用
# Settings → Actions → General → Disable Actions

# 方法 2: 重命名文件
mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled
```
