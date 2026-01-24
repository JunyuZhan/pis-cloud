# 移动端 UI 优化指南

## 当前已实现的优化

### ✅ 基础优化
1. **安全区适配**
   - 使用 `env(safe-area-inset-*)` 适配刘海屏
   - 底部安全区 padding
   - `.safe-area-inset-bottom` 工具类

2. **触摸目标**
   - 所有按钮最小高度 44px（Apple HIG 标准）
   - 图标按钮最小 44px × 44px
   - 使用 `min-h-[44px]` 和 `min-w-[44px]`

3. **响应式布局**
   - 使用 Tailwind 响应式前缀（sm:, md:, lg:）
   - 移动端优先设计（Mobile First）
   - 网格布局自适应（grid-cols-1 md:grid-cols-2 lg:grid-cols-3）

4. **文字优化**
   - 移动端隐藏长文本，显示简短版本
   - 使用 `hidden sm:inline` 和 `sm:hidden`
   - 响应式字体大小（text-sm sm:text-base）

5. **输入框优化**
   - 防止 iOS Safari 自动缩放（font-size: 16px）
   - 移动端输入框字体大小固定

6. **交互优化**
   - 禁用点击高亮（-webkit-tap-highlight-color: transparent）
   - 防止橡皮筋效果（overscroll-behavior-y: none）
   - 按钮 active 状态反馈（active:scale-[0.98]）

### ✅ 组件级优化
1. **相册列表**
   - 移动端按钮始终显示（opacity-100）
   - 桌面端悬停显示（opacity-70 → 100）
   - 响应式网格布局

2. **照片网格**
   - 移动端 2 列，桌面端更多列
   - 触摸友好的间距
   - 响应式图片尺寸

3. **对话框**
   - 移动端底部弹出（bottom-0）
   - 桌面端居中显示
   - 安全区适配

## 待优化的项目

### 🔴 高优先级

#### 1. 移动端导航优化
**问题**：
- 移动端缺少底部导航栏
- 返回操作不够明显
- 导航层级不清晰

**优化方案**：
```tsx
// 添加移动端底部导航栏
<nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border safe-area-inset-bottom sm:hidden">
  <div className="flex items-center justify-around h-16">
    <Link href="/admin" className="flex flex-col items-center gap-1">
      <Home className="w-5 h-5" />
      <span className="text-xs">首页</span>
    </Link>
    <Link href="/admin/albums" className="flex flex-col items-center gap-1">
      <FolderOpen className="w-5 h-5" />
      <span className="text-xs">相册</span>
    </Link>
    {/* ... */}
  </div>
</nav>
```

#### 2. 移动端手势支持
**问题**：
- 缺少滑动操作（左滑删除、右滑操作）
- 照片浏览缺少手势导航

**优化方案**：
```tsx
// 使用 react-swipeable 或 framer-motion
import { useSwipeable } from 'react-swipeable'

const handlers = useSwipeable({
  onSwipedLeft: () => handleDelete(),
  onSwipedRight: () => handleEdit(),
  trackMouse: true
})

<div {...handlers}>
  {/* 卡片内容 */}
</div>
```

#### 3. 移动端下拉刷新
**问题**：
- 缺少下拉刷新功能
- 用户需要手动刷新页面

**优化方案**：
```tsx
// 使用 react-pull-to-refresh 或自定义实现
import PullToRefresh from 'react-pull-to-refresh'

<PullToRefresh
  onRefresh={handleRefresh}
  pullingContent={<Loader2 className="animate-spin" />}
>
  {/* 内容 */}
</PullToRefresh>
```

#### 4. 移动端长按菜单
**问题**：
- 缺少上下文菜单
- 操作不够直观

**优化方案**：
```tsx
// 长按显示操作菜单
const [longPressMenu, setLongPressMenu] = useState<{x: number, y: number} | null>(null)

const handleLongPress = (e: React.TouchEvent) => {
  e.preventDefault()
  setLongPressMenu({ x: e.touches[0].clientX, y: e.touches[0].clientY })
}

<div
  onTouchStart={handleLongPress}
  onTouchEnd={() => setTimeout(() => setLongPressMenu(null), 3000)}
>
  {/* 内容 */}
</div>
```

### 🟡 中优先级

#### 5. 移动端性能优化
**问题**：
- 图片加载可能影响性能
- 长列表滚动性能

**优化方案**：
```tsx
// 1. 图片懒加载（已有，但可以优化）
<Image
  loading="lazy"
  placeholder="blur"
  blurDataURL={blurDataURL}
/>

// 2. 虚拟滚动（长列表）
import { useVirtualizer } from '@tanstack/react-virtual'

// 3. 图片预加载策略优化
// 只预加载可见区域附近的图片
```

#### 6. 移动端键盘优化
**问题**：
- 输入框被键盘遮挡
- 表单提交按钮不可见

**优化方案**：
```tsx
// 使用 react-native-keyboard-aware-scroll-view 或自定义实现
// 监听键盘事件，调整滚动位置
useEffect(() => {
  const handleKeyboardShow = () => {
    // 滚动到输入框位置
  }
  window.addEventListener('keyboardDidShow', handleKeyboardShow)
  return () => window.removeEventListener('keyboardDidShow', handleKeyboardShow)
}, [])
```

#### 7. 移动端加载状态优化
**问题**：
- 加载状态不够明显
- 缺少骨架屏

**优化方案**：
```tsx
// 添加骨架屏组件
function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="aspect-[4/3] bg-surface rounded-lg mb-4" />
      <div className="h-4 bg-surface rounded w-3/4 mb-2" />
      <div className="h-3 bg-surface rounded w-1/2" />
    </div>
  )
}
```

### 🟢 低优先级

#### 8. 移动端动画优化
**问题**：
- 动画可能影响性能
- 缺少移动端特定的动画

**优化方案**：
```tsx
// 使用 CSS transform 代替 position
// 减少重绘和重排
// 使用 will-change 提示浏览器优化
<div className="will-change-transform">
  {/* 动画内容 */}
</div>
```

#### 9. 移动端分享优化
**问题**：
- 分享功能可以更便捷
- 缺少原生分享 API 集成

**优化方案**：
```tsx
// 使用 Web Share API
if (navigator.share) {
  navigator.share({
    title: '相册标题',
    text: '相册描述',
    url: shareUrl
  })
} else {
  // 降级到复制链接
}
```

#### 10. 移动端离线支持
**问题**：
- PWA 已实现，但可以优化
- 离线状态提示不够明显

**优化方案**：
```tsx
// 显示离线状态
const [isOnline, setIsOnline] = useState(navigator.onLine)

useEffect(() => {
  const handleOnline = () => setIsOnline(true)
  const handleOffline = () => setIsOnline(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [])

{!isOnline && (
  <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-2">
    当前处于离线状态
  </div>
)}
```

## 移动端最佳实践检查清单

### 布局和设计
- [x] 响应式布局（Mobile First）
- [x] 触摸目标 ≥ 44px
- [x] 安全区适配
- [x] 文字大小可读（≥ 14px）
- [ ] 底部导航栏（移动端）
- [ ] 手势支持

### 性能
- [x] 图片懒加载
- [x] 图片优化（WebP/AVIF）
- [ ] 虚拟滚动（长列表）
- [ ] 骨架屏加载
- [ ] 代码分割

### 交互
- [x] 点击反馈（active 状态）
- [x] 防止意外缩放
- [x] 防止橡皮筋效果
- [ ] 下拉刷新
- [ ] 长按菜单
- [ ] 滑动操作

### 无障碍
- [x] 触摸目标大小
- [x] 文字对比度
- [x] 键盘导航支持
- [ ] 屏幕阅读器优化
- [ ] 语音输入支持

### PWA
- [x] Service Worker
- [x] Manifest.json
- [x] 离线支持
- [ ] 推送通知
- [ ] 后台同步

## 实施优先级

1. **立即实施**（影响用户体验）
   - 移动端底部导航栏
   - 手势支持（滑动删除）
   - 下拉刷新

2. **近期实施**（提升体验）
   - 长按菜单
   - 骨架屏加载
   - 键盘优化

3. **长期优化**（性能提升）
   - 虚拟滚动
   - 动画优化
   - 离线功能增强

## 参考资源

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design - Mobile](https://material.io/design/usability/accessibility.html)
- [Web.dev - Mobile UX](https://web.dev/mobile/)
