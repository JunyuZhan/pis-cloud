# 分享图片 URL 功能说明

## 📖 什么是分享图片 URL？

**分享图片 URL** (`share_image_url`) 是一个可选的相册配置字段，用于指定当相册链接被分享到社交媒体平台（如微信、朋友圈、Facebook、Twitter等）时显示的预览图片。

## 🎯 功能作用

### 1. **社交媒体分享卡片预览**

当用户将相册链接分享到社交平台时，平台会抓取网页的元数据（Open Graph 标签）来生成一个**分享卡片**，这个卡片包含：
- **标题** (`share_title` 或 `title`)
- **描述** (`share_description` 或 `description`)
- **预览图片** (`share_image_url` 或封面图)

分享图片 URL 就是用来指定这个预览图片的。

### 2. **实际应用场景**

#### 场景一：微信分享
```
用户A在微信中分享相册链接
    ↓
微信抓取网页的 og:image 标签
    ↓
显示一个包含图片、标题、描述的卡片
    ↓
用户B点击卡片进入相册
```

#### 场景二：朋友圈分享
```
用户在朋友圈分享相册链接
    ↓
朋友圈自动生成预览卡片
    ↓
其他用户看到精美的预览图
    ↓
吸引更多点击和浏览
```

## 🔄 优先级逻辑

系统按以下优先级选择分享图片：

```
1. 自定义分享图片 (share_image_url)
   ↓ (如果为空)
2. 相册封面图 (cover_photo_id 对应的照片)
   ↓ (如果封面图不存在)
3. 默认应用图标 (/icons/icon-512x512.png)
```

## 📝 代码实现

### 在相册设置表单中

```tsx
// apps/web/src/components/admin/album-settings-form.tsx
<div>
  <label>分享图片 URL</label>
  <input
    type="url"
    value={formData.share_image_url}
    onChange={(e) => handleChange('share_image_url', e.target.value)}
    placeholder="https://example.com/share-image.jpg"
  />
  <p>建议尺寸：1200x630px。留空则使用相册封面图</p>
</div>
```

### 在元数据生成中

```tsx
// apps/web/src/app/album/[slug]/page.tsx
// 获取分享图片（优先使用自定义图片，否则使用封面图）
let shareImage = album.share_image_url
if (!shareImage && album.cover_photo_id) {
  // 使用封面图
  shareImage = `${mediaUrl}/${coverPhoto.preview_key}`
}

// 如果没有图片，使用默认图标
if (!shareImage) {
  shareImage = `${appUrl}/icons/icon-512x512.png`
}

// 生成 Open Graph meta 标签
return {
  openGraph: {
    images: [{
      url: absoluteShareImage,
      width: 1200,
      height: 630,
      alt: album.title,
    }],
  },
  twitter: {
    images: [absoluteShareImage],
  },
  other: {
    'weixin:image': absoluteShareImage, // 微信分享图片
  },
}
```

## 🖼️ 图片要求

### 推荐规格
- **尺寸**: 1200 x 630 像素（16:8.4 比例）
- **格式**: JPG、PNG
- **大小**: 建议小于 1MB（确保快速加载）
- **内容**: 清晰、有吸引力、能代表相册内容

### 为什么是这个尺寸？
- **Open Graph 标准**: Facebook、LinkedIn 等平台推荐
- **微信分享**: 微信也使用类似的图片比例
- **最佳显示效果**: 在各种平台上都能完整显示

## 💡 使用示例

### 示例 1：使用自定义分享图片
```
相册标题: "2024年春季婚礼"
分享图片 URL: https://cdn.example.com/wedding-preview.jpg

分享到微信时显示：
┌─────────────────────────┐
│  [精美的婚礼预览图]      │
│  2024年春季婚礼          │
│  查看精彩照片...         │
└─────────────────────────┘
```

### 示例 2：使用封面图（默认）
```
相册标题: "2024年春季婚礼"
分享图片 URL: (留空)

系统自动使用封面照片作为分享图片
```

### 示例 3：使用默认图标（无封面）
```
相册标题: "2024年春季婚礼"
分享图片 URL: (留空)
封面图: (无)

系统使用应用图标作为分享图片
```

## 🔒 安全验证

系统会对分享图片 URL 进行严格验证：

1. **协议检查**: 只允许 `http://` 或 `https://`
2. **SSRF 防护**: 禁止内网地址（localhost、192.168.x.x、10.x.x.x 等）
3. **格式验证**: 必须是有效的 URL 格式

```typescript
// 验证逻辑（在 API 路由中）
const url = new URL(shareImageUrl.trim())
if (!['http:', 'https:'].includes(url.protocol)) {
  return error('分享图片URL必须使用 http 或 https 协议')
}

// 检查是否为内网地址
if (isLocalhost || isPrivateIP) {
  return error('分享图片URL不能使用内网地址')
}
```

## 📱 支持的平台

分享图片 URL 会在以下平台生效：

1. **微信/朋友圈** - 通过 `weixin:image` meta 标签
2. **Facebook** - 通过 `og:image` meta 标签
3. **Twitter** - 通过 Twitter Card meta 标签
4. **LinkedIn** - 通过 Open Graph meta 标签
5. **其他支持 Open Graph 的平台**

## 🎨 最佳实践

### 1. **选择合适的图片**
- 使用最能代表相册内容的图片
- 确保图片清晰、有吸引力
- 避免使用过于复杂的图片（小尺寸下可能看不清）

### 2. **图片优化**
- 压缩图片大小，提高加载速度
- 使用 CDN 加速图片加载
- 确保图片 URL 可公开访问

### 3. **测试分享效果**
- 在微信中测试分享卡片显示
- 使用 Facebook 分享调试工具测试
- 使用 Twitter Card 验证器测试

## ❓ 常见问题

### Q1: 为什么设置了分享图片 URL，但分享时还是显示封面图？
**A**: 检查以下几点：
1. 图片 URL 是否可公开访问
2. 图片 URL 格式是否正确（必须是完整的 http/https URL）
3. 清除浏览器缓存后重试
4. 某些平台（如微信）会缓存分享卡片，需要等待一段时间

### Q2: 可以使用相对路径吗？
**A**: 不可以。分享图片 URL 必须是完整的绝对 URL（以 `http://` 或 `https://` 开头），因为：
- 社交媒体平台需要从外部访问图片
- 相对路径无法被外部平台正确解析

### Q3: 图片尺寸必须是 1200x630 吗？
**A**: 不是必须的，但建议使用这个尺寸：
- 这是 Open Graph 标准推荐尺寸
- 在各种平台上显示效果最好
- 其他尺寸也可以，但可能被裁剪或显示不全

### Q4: 可以上传图片文件吗？
**A**: 目前需要手动输入图片 URL。如果需要上传功能，可以考虑：
1. 先上传图片到存储服务（MinIO/OSS/COS）
2. 获取图片的公开访问 URL
3. 将 URL 填入分享图片 URL 字段

## 📚 相关文档

- [Open Graph 协议](https://ogp.me/)
- [Twitter Card 文档](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [微信分享文档](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html)
