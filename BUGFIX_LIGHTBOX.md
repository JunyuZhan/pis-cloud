# 🐛 Lightbox 客户端错误修复

**问题**: 点击照片时出现黑屏，显示 "Application error: a client-side exception has occurred"

**修复时间**: 2026-01-24

## 🔍 问题分析

可能的原因：
1. `currentPhoto` 可能为 `null` 或 `undefined`
2. `selectedMap[currentPhoto?.id]` 访问时可能出错
3. `index` 可能无效（-1 或超出范围）
4. `mediaUrl` 可能未配置
5. `slides` 数组可能为空或格式错误

## ✅ 修复内容

### 1. 修复 currentPhoto 空值检查

**问题**: `currentPhoto` 可能返回 `null`，但后续代码直接访问 `currentPhoto.id`

**修复**:
```typescript
// 修复前
const currentPhoto = useMemo(() => {
  return photos[currentIndex] || photos[0]  // 可能返回 undefined
}, [photos, currentIndex])

// 修复后
const currentPhoto = useMemo(() => {
  if (photos.length === 0) return null
  if (currentIndex >= 0 && currentIndex < photos.length) {
    return photos[currentIndex]
  }
  return photos[0] || null  // 明确返回 null
}, [photos, currentIndex])
```

### 2. 修复 selectedMap 访问

**问题**: `selectedMap[currentPhoto?.id]` 在 `currentPhoto` 为 `null` 时会出错

**修复**:
```typescript
// 修复前
selectedMap[currentPhoto?.id]  // 可能访问 undefined

// 修复后
const currentPhotoId = currentPhoto.id
const isSelected = selectedMap[currentPhotoId] || false
```

### 3. 修复 index 初始化

**问题**: `index` 可能为 -1，导致 `currentIndex` 无效

**修复**:
```typescript
// 修复前
const [currentIndex, setCurrentIndex] = useState(index)  // index 可能是 -1

// 修复后
const [currentIndex, setCurrentIndex] = useState(() => {
  if (index >= 0 && index < photos.length) {
    return index
  }
  return 0  // 默认返回 0
})
```

### 4. 添加 mediaUrl 检查

**问题**: `NEXT_PUBLIC_MEDIA_URL` 可能未配置，导致图片 URL 构建失败

**修复**:
```typescript
// 添加检查
if (!mediaUrl) {
  console.error('NEXT_PUBLIC_MEDIA_URL is not configured. Cannot display images.')
  return null
}
```

### 5. 改进图片 URL 构建

**问题**: URL 拼接可能产生双斜杠或格式错误

**修复**:
```typescript
// 修复前
src: imageKey ? `${mediaUrl}/${imageKey}` : ''

// 修复后
const imageSrc = imageKey && mediaUrl 
  ? `${mediaUrl.replace(/\/$/, '')}/${imageKey.replace(/^\//, '')}` 
  : ''
```

### 6. 添加渲染前检查

**问题**: 在渲染 Lightbox 前没有充分验证数据

**修复**:
```typescript
// 添加多层检查
if (!open || photos.length === 0) return null
if (!mediaUrl) return null
if (slides.length === 0) return null
if (!currentPhoto || !currentPhoto.id) return null

// 确保当前 slide 存在
const currentSlide = slides[validIndex]
if (!currentSlide || !currentSlide.src) {
  console.warn('Current slide is missing')
  return null
}
```

### 7. 修复 masonry.tsx 中的索引检查

**问题**: 传递无效的 index (-1) 给 Lightbox

**修复**:
```typescript
// 修复前
<PhotoLightbox
  photos={photos}
  index={lightboxIndex !== null ? lightboxIndex : -1}  // 可能传递 -1
  open={lightboxIndex !== null}
/>

// 修复后
{lightboxIndex !== null && 
 lightboxIndex >= 0 && 
 lightboxIndex < photos.length && (
  <PhotoLightbox
    photos={photos}
    index={lightboxIndex}  // 确保索引有效
    open={true}
  />
)}
```

## 🧪 测试建议

1. **测试正常情况**:
   - 点击照片，Lightbox 应该正常打开
   - 切换照片，应该正常切换
   - 关闭 Lightbox，应该正常关闭

2. **测试边界情况**:
   - 只有一张照片时
   - 照片数组为空时
   - mediaUrl 未配置时

3. **检查浏览器控制台**:
   - 不应该有错误信息
   - 如果有警告，检查是否是预期的

## 📝 需要检查的配置

### Vercel 环境变量

确保以下环境变量已正确配置：

```
NEXT_PUBLIC_MEDIA_URL=https://media.albertzhan.top/pis-photos
```

**注意**: 
- URL 应该包含 bucket 路径 `/pis-photos`
- 不应该以斜杠结尾
- 应该使用 HTTPS（生产环境）

## 🔧 如果问题仍然存在

1. **检查浏览器控制台**:
   - 打开开发者工具 (F12)
   - 查看 Console 标签
   - 查看 Network 标签，检查图片请求是否失败

2. **检查环境变量**:
   ```bash
   # 在 Vercel Dashboard 中检查
   Settings → Environment Variables → NEXT_PUBLIC_MEDIA_URL
   ```

3. **检查图片 URL**:
   - 在控制台查看构建的图片 URL
   - 手动访问 URL 测试是否可访问

4. **检查照片数据**:
   - 确认照片有 `preview_key` 或 `thumb_key`
   - 确认照片状态为 `completed`

## 📋 修复文件清单

- ✅ `apps/web/src/components/album/lightbox.tsx` - 主要修复
- ✅ `apps/web/src/components/album/masonry.tsx` - 索引检查修复
- ✅ `apps/web/src/components/album/lightbox-error-boundary.tsx` - 错误边界（可选）

---

**修复完成！** 请重新部署到 Vercel 并测试。
