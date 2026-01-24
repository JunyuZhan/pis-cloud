# PIS 系统测试脚本说明

## 测试脚本列表

### 1. test-system.sh - 基础功能测试
测试系统的基础功能：
- 首页可访问性
- 管理后台登录页
- 访问控制
- API 端点可访问性
- 静态资源加载
- 响应时间
- SSL/HTTPS
- 错误页面处理

**运行方式**:
```bash
./scripts/test-system.sh
```

### 2. test-functional.sh - 功能测试
测试系统的功能特性：
- API 响应格式
- CORS 配置
- 安全头
- 页面元数据
- PWA 配置
- API 错误处理
- 响应式设计

**运行方式**:
```bash
./scripts/test-functional.sh
```

### 3. test-api.sh - API 功能测试
测试 API 端点的功能：
- 公开相册 API
- 管理 API 认证
- 照片 API
- 下载 API
- 选片 API
- API 响应时间
- API 一致性

**运行方式**:
```bash
./scripts/test-api.sh
```

### 4. run-all-tests.sh - 综合测试
运行所有测试套件并生成报告：
- 运行所有测试脚本
- 汇总测试结果
- 生成测试报告

**运行方式**:
```bash
./scripts/run-all-tests.sh
```

## 环境变量配置

可以通过环境变量自定义测试配置：

```bash
# 设置测试环境URL
export PIS_BASE_URL=https://yourdomain.com

# 运行测试
./scripts/test-system.sh
```

## 测试报告

测试报告会在终端输出，也可以重定向到文件保存：
```bash
./scripts/run-all-tests.sh > test-report.txt
```

## 测试结果

运行测试脚本查看最新测试结果：

```bash
./scripts/run-all-tests.sh
```

## 注意事项

- 所有测试脚本都使用环境变量配置，不会硬编码敏感信息
- 测试脚本中的默认值（如 `test-password-123`）仅用于测试环境
- 生产环境请使用强密码和安全的配置
