# 🔒 开源安全检查清单

> 本文档提供了在公开 GitHub 仓库之前需要完成的安全检查清单和最佳实践。

**最后更新**: 2026-01-24

## ✅ 安全检查清单

在公开仓库之前，请完成以下检查：

### 1. 敏感文件检查

确认以下文件**未被 Git 跟踪**：

```bash
# 检查是否有敏感文件被 Git 跟踪
git ls-files | grep -E "\.env$|\.env\.local$|\.key$|\.pem$"
```

**预期结果：** 应该没有输出，表示这些文件未被跟踪。

**需要排除的文件：**
- ✅ `.env.local` - 应在 `.gitignore` 中
- ✅ `services/worker/.env` - 应在 `.gitignore` 中
- ✅ 所有密钥文件（`.key`, `.pem`, `.p12`）
- ✅ SSH 密钥文件

### 2. Git 历史检查

检查 Git 历史中是否有敏感文件：

```bash
# 检查 Git 历史中是否有敏感文件
git log --all --full-history --source -- .env.local services/worker/.env .env
```

**预期结果：** 应该没有输出，表示历史记录干净。

**如果发现敏感文件在历史中：**

```bash
# 使用 git-filter-repo（推荐）
pip install git-filter-repo
git filter-repo --path .env.local --path services/worker/.env --invert-paths

# ⚠️ 警告：这会重写 Git 历史，如果已推送到远程，需要强制推送
git push origin --force --all
```

### 3. 硬编码密钥检查

检查代码中是否有硬编码的密钥：

```bash
# 检查 JWT tokens
grep -r "eyJ[A-Za-z0-9_-]\{50,\}" --exclude-dir=node_modules --exclude-dir=.git .

# 检查 AWS keys
grep -r "AKIA[0-9A-Z]\{16\}" --exclude-dir=node_modules --exclude-dir=.git .

# 检查其他常见密钥格式
grep -ri "password.*=.*['\"][^'\"]\{8,\}" --exclude-dir=node_modules --exclude-dir=.git .
```

**预期结果：** 应该没有输出，或只有 `.env.example` 中的占位符。

### 4. 环境变量示例文件检查

确认 `.env.example` 只包含占位符：

```bash
# 检查 .env.example 文件
cat .env.example | grep -E "(your-|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.\.\.)"
```

**预期结果：** 所有值都应该是占位符（`your-...`, `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`）

### 5. .gitignore 配置检查

确认 `.gitignore` 包含以下规则：

```gitignore
# Environment files
.env
.env.local
.env.*.local
!.env.example

# Keys and certificates
*.key
*.pem
*.p12
*.p8
id_rsa
id_rsa.pub
```

## 🛡️ 安全最佳实践

### 1. 使用环境变量

✅ **正确：**
```typescript
const apiKey = process.env.API_KEY;
```

❌ **错误：**
```typescript
const apiKey = "sk-1234567890abcdef";
```

### 2. 使用 .env.example

始终提供 `.env.example` 文件，包含所有必需的环境变量，但使用占位符：

```bash
# .env.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. 文档中的示例

在文档中使用明显的占位符：

```bash
# ✅ 好的示例
STORAGE_ACCESS_KEY=your-access-key-id

# ❌ 不好的示例（看起来像真实密钥）
STORAGE_ACCESS_KEY=LTAI5t1234567890abcdef
```

### 4. 使用 GitHub Secrets

在 GitHub Actions 中使用 Secrets 存储敏感信息，不要硬编码在 workflow 文件中。

## 🔍 自动化安全检查

使用项目提供的安全检查脚本：

```bash
# 运行安全检查
bash scripts/check-security.sh
```

脚本会检查：
1. 敏感文件是否被 Git 跟踪
2. Git 历史中是否有敏感文件
3. 是否有硬编码的 JWT tokens
4. 是否有 AWS Access Keys
5. 是否有硬编码的密码
6. `.env.example` 是否只包含占位符
7. `.gitignore` 是否正确配置

**预期输出：**
```
✅ 安全检查通过！可以安全地公开仓库。
```

## ⚠️ 如果密钥已泄露

如果发现密钥已经被提交到公开仓库：

### 1. 立即撤销所有密钥

- **Supabase**: 登录 Dashboard → Settings → API → 重新生成 Service Role Key
- **Vercel**: 登录 Dashboard → Settings → Tokens → 删除泄露的 token → 生成新的 token
- **OSS/COS/S3**: 登录控制台 → 重新生成所有 Access Key

### 2. 从 Git 历史中删除

```bash
# 使用 git-filter-repo
pip install git-filter-repo
git filter-repo --path .env.local --path services/worker/.env --invert-paths
git push origin --force --all
```

### 3. 更新本地配置

更新所有 `.env` 文件中的密钥。

## 📋 公开仓库前的最终检查清单

- [ ] 确认 `.env.local` 未被 Git 跟踪
- [ ] 确认 `services/worker/.env` 未被 Git 跟踪
- [ ] 确认 Git 历史中没有敏感文件
- [ ] 确认代码中没有硬编码的密钥
- [ ] 确认 `.env.example` 只包含占位符
- [ ] 确认文档中的示例都是占位符
- [ ] 确认 `.gitignore` 正确配置
- [ ] 已运行 `scripts/check-security.sh` 并通过
- [ ] 如果密钥已泄露，已重新生成所有密钥
- [ ] 已测试使用 `.env.example` 可以正常配置项目

## 🚀 公开仓库步骤

1. **运行安全检查**
   ```bash
   bash scripts/check-security.sh
   ```

2. **确认检查通过**
   - 应该看到 "✅ 安全检查通过！可以安全地公开仓库。"

3. **提交代码**
   ```bash
   git add .
   git commit -m "chore: prepare for open source release"
   ```

4. **推送到 GitHub**
   ```bash
   git push origin main
   ```

5. **在 GitHub 上设置为公开**
   - Settings → Change repository visibility → Make public

## 📊 当前项目安全检查结果

### ✅ 安全检查状态

- ✅ **没有敏感文件被 Git 跟踪**
- ✅ **Git 历史中没有敏感文件**
- ✅ **没有发现硬编码的 JWT tokens**
- ✅ **没有发现 AWS Access Keys**
- ✅ **没有发现硬编码的密码**
- ✅ **`.env.example` 只包含占位符**
- ✅ **`.gitignore` 正确配置**

### ✅ 文档完整性

- ✅ LICENSE 文件存在（MIT License）
- ✅ README.md 完整且专业
- ✅ README.zh-CN.md 中文文档完整
- ✅ CONTRIBUTING.md 贡献指南存在
- ✅ AUTHORS.md 作者信息存在
- ✅ GitHub Issue 模板已配置

### ✅ 代码质量

- ✅ 使用 TypeScript 进行类型安全
- ✅ ESLint 代码检查工具已配置
- ✅ Prettier 代码格式化工具已配置
- ✅ 清晰的 monorepo 项目结构

## 📚 相关资源

- [GitHub 安全最佳实践](https://docs.github.com/en/code-security)
- [Git 敏感数据清理](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP 密钥管理指南](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**项目已准备好开源！** 🎉
