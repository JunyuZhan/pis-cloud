# 一键部署

## 最简单的方式

**SSH 登录到服务器，运行：**

```bash
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
```

按提示操作即可。

## 需要什么？

1. 一台 Linux 服务器（Ubuntu/Debian/CentOS）
2. 2核2G 以上配置
3. 如果选 Supabase，需要准备 Supabase URL 和 Key

## 获取 Supabase 信息

1. 访问 https://supabase.com/dashboard
2. 选择项目 → Settings → API
3. 复制 Project URL 和 service_role key

就这么简单！
