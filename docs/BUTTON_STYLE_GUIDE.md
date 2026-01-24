# 按钮风格统一指南

## 概述

本文档定义了系统中所有按钮的统一风格和使用规范，确保用户体验的一致性。

## 按钮组件

### 使用 Button 组件（推荐）

```tsx
import { Button } from '@/components/ui/button'

<Button variant="primary" size="md" isLoading={loading}>
  提交
</Button>
```

### 使用 CSS 类（兼容现有代码）

```tsx
<button className="btn-primary" type="button">
  提交
</button>
```

## 按钮变体

### Primary（主要操作）
- **用途**：主要操作，如提交、确认、创建
- **样式**：金色背景（accent），深色文字
- **使用场景**：表单提交、创建新内容、确认操作

```tsx
<Button variant="primary">创建相册</Button>
// 或
<button className="btn-primary">创建相册</button>
```

### Secondary（次要操作）
- **用途**：次要操作，如取消、返回
- **样式**：浅色背景，边框，文字颜色较浅
- **使用场景**：取消操作、返回、关闭对话框

```tsx
<Button variant="secondary">取消</Button>
// 或
<button className="btn-secondary">取消</button>
```

### Ghost（幽灵按钮）
- **用途**：不重要的操作，如编辑、删除（非危险）
- **样式**：透明背景，悬停时显示背景
- **使用场景**：编辑、设置、次要操作

```tsx
<Button variant="ghost">编辑</Button>
// 或
<button className="btn-ghost">编辑</button>
```

### Danger（危险操作）
- **用途**：危险操作，如删除、永久删除
- **样式**：红色背景，白色文字
- **使用场景**：删除、永久删除、不可逆操作

```tsx
<Button variant="danger">删除</Button>
// 或
<button className="btn-danger">删除</button>
```

## 按钮尺寸

### Small (sm)
- **高度**：36px
- **内边距**：px-3 py-1.5
- **文字大小**：text-sm
- **使用场景**：紧凑空间、表格操作、标签页

### Medium (md) - 默认
- **高度**：44px（移动端标准触摸目标）
- **内边距**：px-4 py-2
- **文字大小**：text-base
- **使用场景**：大多数按钮、表单按钮

### Large (lg)
- **高度**：48px
- **内边距**：px-6 py-3
- **文字大小**：text-lg
- **使用场景**：主要 CTA、Hero 区域按钮

## 按钮状态

### 默认状态
- 正常显示，可点击

### 加载状态
```tsx
<Button isLoading={true}>提交</Button>
```
- 显示加载动画
- 自动禁用按钮
- 防止重复提交

### 禁用状态
```tsx
<Button disabled={true}>提交</Button>
// 或
<button className="btn-primary" disabled>提交</button>
```
- 降低透明度（50%）
- 鼠标指针变为 not-allowed
- 不可点击

### 悬停状态
- 所有按钮都有悬停效果
- Primary: 背景色变暗
- Secondary: 背景色和边框颜色变化
- Ghost: 显示背景色
- Danger: 背景色变深

### 激活状态（点击）
- 所有按钮都有 `active:scale-[0.98]` 效果
- 提供触觉反馈

## 必需属性

### type="button"
**所有按钮都必须设置 `type="button"`**，除非是表单提交按钮。

```tsx
// ✅ 正确
<button type="button" onClick={handleClick}>点击</button>

// ❌ 错误（可能导致表单意外提交）
<button onClick={handleClick}>点击</button>
```

### aria-label 或 title
对于图标按钮，必须提供无障碍标签：

```tsx
// ✅ 正确
<button type="button" aria-label="删除" onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</button>

// ✅ 正确
<button type="button" title="删除" onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</button>
```

## 按钮组合

### 对话框按钮组
```tsx
<DialogFooter>
  <Button variant="secondary" onClick={onCancel}>取消</Button>
  <Button variant="primary" onClick={onConfirm}>确认</Button>
</DialogFooter>
```

### 危险操作按钮组
```tsx
<DialogFooter>
  <Button variant="secondary" onClick={onCancel}>取消</Button>
  <Button variant="danger" onClick={onDelete}>删除</Button>
</DialogFooter>
```

## 移动端优化

### 最小触摸目标
- **标准**：44px × 44px（Apple HIG 推荐）
- **最小**：36px × 36px（紧凑空间）
- 所有按钮默认 `min-h-[44px]`

### 响应式按钮
```tsx
<Button 
  className="w-full sm:w-auto"
  size="md"
>
  响应式按钮
</Button>
```

## 常见错误

### ❌ 错误示例

```tsx
// 1. 缺少 type="button"
<button onClick={handleClick}>点击</button>

// 2. 内联样式替代类
<button className="px-4 py-2 bg-accent text-white rounded-lg">
  点击
</button>

// 3. 不一致的尺寸
<button className="btn-primary h-10">按钮1</button>
<button className="btn-primary h-12">按钮2</button>

// 4. 缺少无障碍标签
<button onClick={handleDelete}>
  <Trash2 />
</button>
```

### ✅ 正确示例

```tsx
// 1. 使用 Button 组件
<Button variant="primary" type="button" onClick={handleClick}>
  点击
</Button>

// 2. 使用统一的类
<button type="button" className="btn-primary" onClick={handleClick}>
  点击
</button>

// 3. 图标按钮有标签
<button 
  type="button" 
  className="btn-ghost" 
  aria-label="删除"
  onClick={handleDelete}
>
  <Trash2 className="w-4 h-4" />
</button>

// 4. 加载状态
<Button variant="primary" isLoading={isSubmitting}>
  提交
</Button>
```

## 检查清单

在创建或修改按钮时，请检查：

- [ ] 是否设置了 `type="button"`（非提交按钮）
- [ ] 是否使用了统一的按钮类或 Button 组件
- [ ] 是否设置了合适的 `variant`（primary/secondary/ghost/danger）
- [ ] 是否设置了合适的 `size`（sm/md/lg）
- [ ] 图标按钮是否有 `aria-label` 或 `title`
- [ ] 是否处理了 `disabled` 状态
- [ ] 是否处理了 `isLoading` 状态（如需要）
- [ ] 移动端触摸目标是否足够大（≥44px）

## 迁移指南

### 从内联样式迁移到统一类

```tsx
// 之前
<button className="px-4 py-2 bg-accent text-background rounded-lg">
  提交
</button>

// 之后
<button type="button" className="btn-primary">
  提交
</button>
```

### 从类迁移到 Button 组件

```tsx
// 之前
<button className="btn-primary" disabled={loading}>
  {loading ? '提交中...' : '提交'}
</button>

// 之后
<Button variant="primary" isLoading={loading}>
  提交
</Button>
```

## 更新日志

- **2026-01-24**: 创建统一按钮风格指南
- **2026-01-24**: 添加 Button 组件
- **2026-01-24**: 统一最小触摸目标为 44px
- **2026-01-24**: 添加 btn-danger 类
