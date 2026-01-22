FROM node:20-alpine

# 安装必要的系统依赖 (Sharp 需要)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制 Worker 项目文件
COPY services/worker/package.json services/worker/pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY services/worker/src ./src
COPY services/worker/tsconfig.json ./

# 构建
RUN pnpm build

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# 运行
CMD ["node", "dist/index.js"]
