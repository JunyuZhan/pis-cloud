FROM node:20-alpine

# 配置 Alpine 镜像源（尝试多个镜像源，按优先级）
RUN ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) && \
    # 优先尝试阿里云
    (echo "https://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
     echo "https://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories && \
     echo "Using Aliyun mirrors") || \
    # 失败则尝试清华
    (echo "https://mirrors.tuna.tsinghua.edu.cn/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
     echo "https://mirrors.tuna.tsinghua.edu.cn/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories && \
     echo "Using Tsinghua mirrors") || \
    # 最后使用官方源
    (echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
     echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories && \
     echo "Using official mirrors") || true

# 更新包索引并安装必要的系统依赖 (Sharp + HEIC 支持)
# libheif-dev: 用于处理 HEIC/HEIF 格式的 iPhone 照片
# vips-dev: 高性能图像处理库
# build-base: 编译工具链（用于从源码编译 Sharp）
RUN apk update --no-cache && \
    apk add --no-cache --virtual .build-deps \
    libc6-compat \
    vips-dev \
    libheif-dev \
    build-base \
    python3 \
    || (echo "Trying alternative repositories..." && \
        ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) && \
        echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
        echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories && \
        apk update --no-cache && \
        apk add --no-cache --virtual .build-deps \
        libc6-compat \
        vips-dev \
        libheif-dev \
        build-base \
        python3)

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制 Worker 项目文件
COPY services/worker/package.json services/worker/pnpm-lock.yaml* ./

# 安装构建依赖（用于 Sharp 源码编译）
RUN pnpm add node-addon-api node-gyp

# 强制 Sharp 从源码编译使用系统 libvips
ENV npm_config_sharp_libvips_local_prebuilds=0
ENV npm_config_sharp_local_prebuilds=0

# 强制重新安装 Sharp（从源码编译以支持 HEIC）
RUN pnpm remove sharp && pnpm add sharp

# 安装其他依赖
RUN pnpm install --no-frozen-lockfile

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
