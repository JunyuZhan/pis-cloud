# PIS 系统性能优化文档

> **优化日期**: 2026-01-24  
> **目标**: 提高访问速度，优化用户体验

---

## 📊 优化统计

| 优化项 | 状态 | 预期提升 |
|--------|------|---------|
| ISR页面缓存 | ✅ 完成 | 50-70% |
| 数据库查询优化 | ✅ 完成 | 30-50% |
| API响应缓存 | ✅ 完成 | 40-60% |
| 图片优化 | ✅ 完成 | 20-30% |
| CDN缓存头 | ✅ 完成 | 30-40% |
| React Query缓存 | ✅ 完成 | 20-30% |
| 字体加载优化 | ✅ 完成 | 15-25% |
| 资源预加载 | ✅ 完成 | 10-20% |
| 代码分割优化 | ✅ 完成 | 20-30% |
| Nginx压缩优化 | ✅ 完成 | 30-50% |
| 组件懒加载 | ✅ 完成 | 15-25% |
| React Query优化 | ✅ 完成 | 10-15% |
| 首屏图片优先级 | ✅ 完成 | 10-20% |
| API ETag支持 | ✅ 完成 | 5-10% |
| 图片智能预加载 | ✅ 完成 | 30-50% |
| 图片质量优化 | ✅ 完成 | 20-30% |
| 图片尺寸优化 | ✅ 完成 | 15-25% |

---

## ✅ 已实施的优化

### 1. ISR（增量静态再生）

**优化位置**:
- `apps/web/src/app/page.tsx` - 首页
- `apps/web/src/app/album/[slug]/page.tsx` - 相册页

**配置**:
```typescript
// 首页：60秒重新验证
export const revalidate = 60

// 相册页：30秒重新验证
export const revalidate = 30
```

**效果**:
- 页面首次访问后会被静态缓存
- 后台自动重新生成，用户始终看到最新内容
- 减少服务器负载，提高响应速度

### 2. 数据库查询优化（减少N+1查询）

**优化位置**: `apps/web/src/app/page.tsx`

**优化前**:
- 每个相册单独查询封面照片（N+1查询）
- 每个相册单独查询第一张照片

**优化后**:
- 批量查询所有封面照片（1次查询）
- 批量查询所有需要的第一张照片（1次查询）
- 使用Map数据结构快速匹配

**效果**:
- 查询次数从 N*2 减少到 2
- 首页加载时间预计减少 30-50%

### 3. API响应缓存

**优化位置**:
- `apps/web/src/app/api/public/albums/[slug]/route.ts`
- `apps/web/src/app/api/public/albums/[slug]/photos/route.ts`

**配置**:
```typescript
// 公开相册：缓存5分钟，后台刷新6分钟
'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'

// 私有相册：不缓存
'Cache-Control': 'private, no-cache, no-store, must-revalidate'
```

**效果**:
- 公开相册API响应被CDN和浏览器缓存
- 减少数据库查询和API处理时间
- 提高并发访问性能

### 4. 图片优化

**优化位置**: `apps/web/next.config.ts`

**配置**:
```typescript
images: {
  formats: ['image/avif', 'image/webp'], // 现代格式优先
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60, // 最小缓存时间60秒
}
```

**效果**:
- 自动使用WebP/AVIF格式（体积更小）
- 响应式图片尺寸
- 减少图片加载时间

### 5. CDN缓存头

**优化位置**: `apps/web/next.config.ts`

**配置**:
```typescript
// 静态资源（图标）：永久缓存
'/icons/:path*': 'public, max-age=31536000, immutable'

// 处理后的图片：永久缓存
'/processed/:path*': 'public, max-age=31536000, immutable'
```

**效果**:
- 静态资源被CDN和浏览器永久缓存
- 减少重复下载
- 提高后续访问速度

### 6. React Query缓存优化

**优化位置**: `apps/web/src/components/album/album-client.tsx`

**配置**:
```typescript
staleTime: 5 * 60 * 1000, // 5分钟缓存
gcTime: 10 * 60 * 1000,   // 10分钟垃圾回收
```

**效果**:
- 减少不必要的API请求
- 提高页面切换速度
- 改善用户体验

### 7. 字体加载优化

**优化位置**: 
- `apps/web/src/app/layout.tsx` - 使用 next/font 优化字体加载
- `apps/web/src/app/globals.css` - 移除阻塞的 @import

**优化前**:
- 使用 Google Fonts 的 `@import` 方式，阻塞渲染
- 字体文件从外部 CDN 加载，增加延迟

**优化后**:
- 使用 Next.js 的 `next/font/google` 自动优化
- 字体文件自托管，减少外部请求
- 自动生成字体 CSS，避免 FOUT（Flash of Unstyled Text）
- 按需加载非关键字体（Noto Serif SC, Playfair Display）

**配置**:
```typescript
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
})
```

**效果**:
- 减少字体加载时间 15-25%
- 避免布局偏移（CLS）
- 提高首次内容绘制（FCP）速度

### 8. 资源预加载优化

**优化位置**: `apps/web/src/app/layout.tsx`

**配置**:
```typescript
{/* DNS 预解析和预连接 */}
<link rel="dns-prefetch" href={mediaHost} />
<link rel="preconnect" href={mediaHost} crossOrigin="anonymous" />
```

**效果**:
- 提前建立到媒体服务器的连接
- 减少图片加载延迟 10-20%
- 提高并发加载能力

### 9. 代码分割优化

**优化位置**: `apps/web/next.config.ts`

**配置**:
- 启用 SWC 压缩
- 优化 Webpack 代码分割策略
- 框架代码、第三方库、公共代码分离打包

**效果**:
- 减少初始 JavaScript bundle 大小 20-30%
- 提高首屏加载速度
- 改善代码缓存效率

### 10. Nginx 压缩优化

**优化位置**: `docker/nginx/media.conf`

**配置**:
- 启用 Gzip 压缩（压缩级别 6）
- 优化连接保持（keepalive）
- 启用 sendfile 和 TCP 优化

**效果**:
- 减少传输数据量 30-50%
- 提高响应速度
- 降低服务器带宽消耗

### 11. 组件懒加载优化

**优化位置**: 
- `apps/web/src/components/album/masonry.tsx` - Lightbox 动态导入
- `apps/web/src/components/admin/album-detail-client.tsx` - Uploader 和 Lightbox 动态导入

**优化前**:
- Lightbox 组件（yet-another-react-lightbox）在初始 bundle 中
- PhotoUploader 组件在管理后台页面加载时即加载

**优化后**:
- 使用 Next.js `dynamic()` 动态导入
- Lightbox 只在用户点击照片时加载
- PhotoUploader 只在管理后台需要时加载
- 减少初始 JavaScript bundle 大小

**配置**:
```typescript
const PhotoLightbox = dynamic(() => import('./lightbox').then(mod => ({ default: mod.PhotoLightbox })), {
  ssr: false,
  loading: () => null,
})
```

**效果**:
- 减少初始 bundle 大小 15-25%
- 提高首屏加载速度
- 按需加载，减少不必要的代码

### 12. React Query 缓存优化

**优化位置**: `apps/web/src/components/providers.tsx`

**优化前**:
- staleTime: 1 分钟
- 没有配置 gcTime（垃圾回收时间）

**优化后**:
- staleTime: 5 分钟（提高缓存时间）
- gcTime: 10 分钟（垃圾回收时间）
- 优化重试策略

**配置**:
```typescript
queries: {
  staleTime: 5 * 60 * 1000, // 5 分钟
  gcTime: 10 * 60 * 1000,   // 10 分钟
  retry: 1,                 // 减少重试次数
  retryDelay: 1000,         // 重试延迟 1 秒
}
```

**效果**:
- 减少不必要的 API 请求 10-15%
- 提高页面切换速度
- 改善用户体验

### 13. 首屏图片优先级优化

**优化位置**: `apps/web/src/components/home/album-grid.tsx`

**配置**:
- 前 4 个相册卡片使用 `priority` 属性
- 优先加载首屏可见区域的图片

**效果**:
- 提高 LCP（最大内容绘制）指标 10-20%
- 改善首屏加载体验
- 减少布局偏移（CLS）

### 14. API ETag 支持

**优化位置**: `apps/web/src/app/api/public/albums/[slug]/route.ts`

**配置**:
- 添加 ETag 响应头
- 支持 If-None-Match 条件请求
- 返回 304 Not Modified 响应

**效果**:
- 减少重复数据传输 5-10%
- 提高缓存效率
- 降低服务器负载

### 15. 图片智能预加载优化

**优化位置**: 
- `apps/web/src/components/ui/optimized-image.tsx` - 新建优化组件
- `apps/web/src/components/album/masonry.tsx` - 使用优化组件
- `apps/web/src/components/home/album-grid.tsx` - 使用优化组件

**优化前**:
- 所有图片使用 `loading="lazy"`，即使是首屏可见的图片
- 没有预加载策略
- 图片质量统一为 85

**优化后**:
- 使用 Intersection Observer 智能预加载
- 视口 200px 范围内的图片提前加载
- 前 6 张图片优先加载（priority）
- 非关键图片质量降低到 75（减少 20-30% 体积）
- 更精确的 sizes 属性匹配

**配置**:
```typescript
// 智能预加载组件
const OptimizedImage = ({
  priority, // 前 6 张图片
  quality: isPriority ? 85 : 75, // 动态质量
  // Intersection Observer 预加载视口 200px 范围内的图片
})
```

**效果**:
- 图片加载速度提升 30-50%
- 减少初始加载的图片体积 20-30%
- 改善用户体验（提前加载即将看到的图片）

### 16. 图片质量优化

**优化位置**: `apps/web/src/components/ui/optimized-image.tsx`

**配置**:
- 首屏图片（前 6 张）：quality 85
- 其他图片：quality 75
- 占位符：quality 60

**效果**:
- 减少图片体积 20-30%
- 保持首屏图片质量
- 提高加载速度

### 17. 图片尺寸和缓存优化

**优化位置**: `apps/web/next.config.ts`

**配置**:
```typescript
images: {
  formats: ['image/avif', 'image/webp'], // AVIF 优先
  minimumCacheTTL: 31536000, // 1 年缓存
  qualities: [60, 75, 85, 100],
}
```

**效果**:
- AVIF 格式体积更小（比 WebP 小 20-30%）
- 长期缓存减少重复下载
- 多质量级别支持

---

## 📈 性能指标对比

### 优化前
- **首页响应时间**: ~1500ms
- **API响应时间**: ~950ms
- **数据库查询**: N+1问题
- **缓存策略**: 无

### 优化后（预期）
- **首页响应时间**: ~500-800ms ⬇️ 50-70%
- **API响应时间**: ~300-500ms ⬇️ 40-60%
- **数据库查询**: 批量查询 ⬇️ 30-50%
- **缓存策略**: 多层缓存 ✅

---

## 🎯 优化效果

### 1. 首次访问
- ✅ ISR预生成页面，响应更快
- ✅ 批量数据库查询，减少等待时间
- ✅ 优化的图片格式，加载更快

### 2. 后续访问
- ✅ 页面静态缓存，几乎瞬时加载
- ✅ API响应缓存，减少服务器负载
- ✅ React Query缓存，减少API请求

### 3. 并发访问
- ✅ CDN缓存，减少源站压力
- ✅ 静态资源永久缓存，提高吞吐量
- ✅ 优化的数据库查询，提高处理能力

---

## 🔍 监控建议

### 1. 性能指标
- **FCP** (First Contentful Paint): 目标 < 1.5s
- **LCP** (Largest Contentful Paint): 目标 < 2.5s
- **TTI** (Time to Interactive): 目标 < 3.5s
- **API响应时间**: 目标 < 500ms

### 2. 监控工具
- Vercel Analytics（已集成）
- Lighthouse CI
- Web Vitals

### 3. 定期检查
- 每周检查性能指标
- 监控缓存命中率
- 分析慢查询

---

## 📝 后续优化建议

### 1. 短期（可选）
- [x] 优化JavaScript bundle大小（代码分割）✅ 已完成
- [x] 添加预加载关键资源（preload/prefetch）✅ 已完成
- [x] 添加图片懒加载（Intersection Observer）✅ 已完成

### 2. 中期（可选）
- [ ] 实施Edge Caching（Vercel Edge）
- [ ] 添加数据库连接池优化
- [ ] 实施API限流和降级策略

### 3. 长期（可选）
- [ ] 考虑使用CDN加速（Cloudflare）
- [ ] 实施GraphQL减少数据传输
- [ ] 添加服务端渲染优化

---

## ✅ 验证清单

- [x] ISR配置已添加
- [x] 数据库查询已优化
- [x] API缓存头已添加
- [x] 图片优化已配置
- [x] CDN缓存头已添加
- [x] React Query缓存已优化
- [x] 字体加载已优化
- [x] 资源预加载已添加
- [x] 代码分割已优化
- [x] Nginx压缩已优化
- [x] 组件懒加载已优化
- [x] React Query缓存已进一步优化
- [x] 首屏图片优先级已优化
- [x] API ETag支持已添加
- [x] 图片智能预加载已优化
- [x] 图片质量已优化
- [x] 图片尺寸和缓存已优化
- [ ] 性能测试已完成（待部署后）
- [ ] 监控已配置（待部署后）

---

## 🚀 部署说明

**重要**: 这些优化需要重新部署才能生效。

### 部署步骤

1. **提交代码**
   ```bash
   git add .
   git commit -m "perf: 实施全面的性能优化"
   git push origin main
   ```

2. **Vercel自动部署**
   - Vercel会自动检测到代码推送
   - 触发新的构建和部署
   - 部署完成后优化生效

3. **验证优化**
   ```bash
   # 检查页面响应时间
   curl -w "@-" -o /dev/null -s "https://yourdomain.com"
   
   # 检查API缓存头
   curl -I "https://yourdomain.com/api/public/albums/test"
   ```

---

---

## 🎯 最新优化（2026-01-24）

### 新增优化项

1. **字体加载优化**
   - 移除阻塞的 Google Fonts @import
   - 使用 next/font 自动优化字体加载
   - 按需加载非关键字体

2. **资源预加载**
   - 添加 DNS prefetch 和 preconnect 到媒体服务器
   - 提前建立连接，减少延迟

3. **代码分割优化**
   - 优化 Webpack 配置
   - 框架代码、第三方库、公共代码分离
   - 减少初始 bundle 大小

4. **Nginx 压缩优化**
   - 启用 Gzip 压缩
   - 优化连接保持和传输效率

### 预期综合提升（最新）

- **首次内容绘制（FCP）**: 提升 50-70% ⬆️⬆️
- **最大内容绘制（LCP）**: 提升 50-70% ⬆️⬆️（图片优化显著提升）
- **总阻塞时间（TBT）**: 减少 40-60% ⬆️⬆️
- **累积布局偏移（CLS）**: 减少 30-40% ⬆️⬆️
- **整体页面加载速度**: 提升 50-65% ⬆️⬆️
- **JavaScript Bundle 大小**: 减少 20-30%
- **API 请求次数**: 减少 15-25%
- **图片加载速度**: 提升 30-50% ⬆️⬆️（新增）
- **图片体积**: 减少 20-30% ⬆️⬆️（新增）

### 最新优化（2026-01-24 第三轮 - 图片加载专项优化）

1. **图片智能预加载**
   - 使用 Intersection Observer 预加载视口 200px 范围内的图片
   - 前 6 张图片优先加载（priority）
   - 智能判断何时开始加载

2. **图片质量优化**
   - 首屏图片：quality 85（保持高质量）
   - 其他图片：quality 75（减少 20-30% 体积）
   - 占位符：quality 60

3. **图片格式和缓存优化**
   - AVIF 格式优先（体积最小）
   - 图片缓存时间延长到 1 年
   - 多质量级别支持

4. **sizes 属性优化**
   - 更精确匹配实际显示尺寸
   - 减少不必要的图片下载

**预期效果**:
- 图片加载速度提升 30-50%
- 图片体积减少 20-30%
- LCP 指标显著改善

---

**最后更新**: 2026-01-24
