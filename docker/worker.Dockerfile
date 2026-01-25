FROM node:20-alpine

# 配置 Alpine 镜像源（使用阿里云镜像，提高国内下载速度）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories || \
    echo "https://mirrors.aliyun.com/alpine/v$(cat /etc/alpine-release | cut -d'.' -f1,2)/main" > /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v$(cat /etc/alpine-release | cut -d'.' -f1,2)/community" >> /etc/apk/repositories

# 更新包索引并安装必要的系统依赖 (Sharp + HEIC 支持)
# libheif-dev: 用于处理 HEIC/HEIF 格式的 iPhone 照片
# vips-dev: 高性能图像处理库
# build-base: 编译工具链（用于从源码编译 Sharp）
RUN apk update && apk add --no-cache \
    libc6-compat \
    vips-dev \
    libheif-dev \
    build-base \
    python3 \
    || (echo "Failed to install packages, trying default repositories..." && \
        sed -i 's/mirrors.aliyun.com/dl-cdn.alpinelinux.org/g' /etc/apk/repositories && \
        apk update && apk add --no-cache \
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
