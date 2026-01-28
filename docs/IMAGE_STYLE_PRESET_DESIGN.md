# 图片调色功能设计文档

> 最后更新: 2026-01-28

## 📋 目录

1. [功能概述](#功能概述)
2. [需求分析](#需求分析)
3. [技术方案](#技术方案)
4. [数据库设计](#数据库设计)
5. [架构设计](#架构设计)
6. [API 设计](#api-设计)
7. [前端设计](#前端设计)
8. [实现计划](#实现计划)
9. [性能考虑](#性能考虑)
10. [测试计划](#测试计划)

---

## 功能概述

### 目标

为 PIS 系统添加图片风格预设功能，允许管理员为相册选择预设的调色风格（如日系小清新、电影感、自然风光等），系统在处理照片时自动应用这些风格效果。预设基于 Lightroom 调色思路，简单可靠，无需专业调色知识。

### 核心价值

- **简单易用**：只需选择预设风格，无需专业调色知识
- **统一风格**：为整个相册应用统一的视觉风格，提升专业度
- **批量处理**：自动为相册内所有照片应用风格，无需手动调整
- **预设可靠**：预设基于成熟的 Lightroom 调色思路，效果稳定
- **性能优化**：服务端处理，一次生成永久使用

---

## 需求分析

### 功能需求

1. **风格预设（核心功能）**
   - **人物风格**：日系小清新、胶片感、电影感、写实、温暖人像等
   - **风景风格**：自然风光、电影感、胶片、怀旧美学、清新自然等
   - **通用风格**：黑白、复古、鲜艳等
   - 预设基于 Lightroom 调色思路，效果可靠
   - 预设数量：15-20 个（分类清晰，不过多）

2. **相册级别配置**
   - 每个相册可选择一种预设风格
   - 风格配置存储在相册表中（JSONB）
   - 支持"无风格"选项（保持原始色彩）
   - 支持预览效果（前端 CSS 滤镜）

3. **图片处理**
   - 在 Worker 处理图片时应用风格预设
   - 只处理预览图和缩略图，原图保持不变
   - 支持重新处理已上传的照片（切换风格时）

4. **用户体验**
   - 创建相册时可选择风格（可选）
   - 相册设置页面可切换风格
   - 预设分类展示（人物/风景/通用）
   - 每个预设显示预览图和说明
   - 实时预览效果（CSS 滤镜）

### 非功能需求

- **性能**：风格处理不应显著增加图片处理时间（< 20%）
- **兼容性**：向后兼容，未配置风格的相册保持原样
- **可扩展性**：易于添加新的风格预设

---

## 技术方案

### 方案对比

#### 方案一：纯服务端处理（推荐）

**优点：**
- 一次处理，永久生效
- 性能好，无需前端实时计算
- 支持批量处理
- 下载的图片也包含风格效果

**缺点：**
- 切换风格需要重新处理所有照片
- 存储空间略增（但可接受）

#### 方案二：纯前端 CSS 滤镜

**优点：**
- 无需重新处理图片
- 实时切换风格
- 零存储成本

**缺点：**
- 下载的图片不包含风格效果
- 性能依赖浏览器
- 效果有限（CSS 滤镜能力受限）

#### 方案三：混合方案（最终选择）

**服务端处理 + 前端预览**

- **服务端**：使用 Sharp 处理图片，生成带风格的预览图和缩略图
- **前端预览**：使用 CSS 滤镜实现实时预览，无需重新处理
- **最佳实践**：结合两者优势，服务端保证质量，前端提供灵活性

### 技术选型

#### 服务端图片处理

使用 **Sharp** 库的以下方法：

**基础调整：**
- `modulate({ brightness, saturation, hue })` - 亮度、饱和度、色相调整
- `contrast(value)` - 对比度调整（-1 到 1）
- `linear(multiply, offset)` - 线性调整（对比度和亮度）
- `gamma(value)` - 伽马校正
- `normalise()` - 自动标准化（可选）

**色彩调整：**
- `tint({ r, g, b })` - 色调叠加（用于色温/色调模拟）
- `greyscale()` - 黑白效果（饱和度 = 0）
- `toColourspace()` - 色彩空间转换（可选）

**色调调整（通过组合实现）：**
- 高光/阴影：使用 `linear()` 和 `gamma()` 组合实现
- 色温：使用 `tint()` 或 `modulate()` 的 hue 参数模拟
- 色调（Tint）：使用 `tint()` 的 RGB 参数实现

**注意：** Sharp 不直接支持高光/阴影调整，需要通过以下方式模拟：
- 高光：降低 gamma + 提高 brightness
- 阴影：提高 gamma + 降低 brightness
- 或使用 `linear()` 的 multiply/offset 参数

#### 前端预览

使用 **CSS Filter** 属性：

- `brightness()` - 亮度
- `contrast()` - 对比度
- `saturate()` - 饱和度
- `hue-rotate()` - 色相旋转
- `sepia()` - 复古效果
- `grayscale()` - 黑白效果

---

## 数据库设计

### 相册表扩展

在 `albums` 表中添加 `style_preset` 字段：

```sql
-- 添加调色配置字段
ALTER TABLE albums 
ADD COLUMN color_grading JSONB DEFAULT NULL;

-- 字段说明：
-- color_grading: null | {
--   "preset": "preset-id",  // 预设 ID（如 "japanese-fresh", "cinematic-portrait" 等）
--   
--   // 预设内部参数（由系统自动生成，管理员无需关心）
--   "brightness": 1.0,      // 亮度调整
--   "contrast": 0.0,        // 对比度调整
--   "saturation": 1.0,      // 饱和度调整
--   "gamma": 1.0,           // 伽马校正
--   "hue": 0,               // 色相旋转
--   "tint": { r, g, b }     // 色调叠加（用于色温模拟）
-- }
--
-- 注意：管理员只需要选择预设 ID，系统会自动应用对应的参数
```

### 索引

无需额外索引（JSONB 字段已支持 GIN 索引，但当前查询场景不需要）

### JSON Schema 校验（重要）

为防止前端传错参数范围导致后端 Sharp 报错，建议在数据库层面添加 JSON Schema 校验：

```sql
-- 创建校验函数
CREATE OR REPLACE FUNCTION validate_color_grading(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  IF config IS NULL THEN
    RETURN TRUE;  -- NULL 是允许的（表示无调色）
  END IF;
  
  -- 验证基础调整参数范围
  IF config->'basic' IS NOT NULL THEN
    IF (config->'basic'->>'brightness')::numeric < 0.0 OR 
       (config->'basic'->>'brightness')::numeric > 2.0 THEN
      RETURN FALSE;
    END IF;
    IF (config->'basic'->>'contrast')::numeric < -1.0 OR 
       (config->'basic'->>'contrast')::numeric > 1.0 THEN
      RETURN FALSE;
    END IF;
    IF (config->'basic'->>'saturation')::numeric < 0.0 OR 
       (config->'basic'->>'saturation')::numeric > 2.0 THEN
      RETURN FALSE;
    END IF;
    IF (config->'basic'->>'gamma')::numeric < 0.1 OR 
       (config->'basic'->>'gamma')::numeric > 3.0 THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- 验证色调调整参数范围
  IF config->'tone' IS NOT NULL THEN
    IF (config->'tone'->>'highlights')::numeric < -1.0 OR 
       (config->'tone'->>'highlights')::numeric > 1.0 THEN
      RETURN FALSE;
    END IF;
    IF (config->'tone'->>'shadows')::numeric < -1.0 OR 
       (config->'tone'->>'shadows')::numeric > 1.0 THEN
      RETURN FALSE;
    END IF;
    -- ... 其他参数校验
  END IF;
  
  -- 验证色彩调整参数范围
  IF config->'color' IS NOT NULL THEN
    IF (config->'color'->>'temperature')::integer < -100 OR 
       (config->'color'->>'temperature')::integer > 100 THEN
      RETURN FALSE;
    END IF;
    IF (config->'color'->>'tint')::integer < -100 OR 
       (config->'color'->>'tint')::integer > 100 THEN
      RETURN FALSE;
    END IF;
    IF (config->'color'->>'hue')::integer < 0 OR 
       (config->'color'->>'hue')::integer > 360 THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 添加 CHECK 约束
ALTER TABLE albums 
ADD CONSTRAINT check_color_grading_valid 
CHECK (validate_color_grading(color_grading));
```

**注意：** 同时在前端和后端 API 层也要进行校验，形成三层防护。

---

## 架构设计

### 数据流

```
用户上传照片
    ↓
前端 API (/api/admin/albums/[id]/upload)
    ↓
创建照片记录（status: 'pending'）
    ↓
加入处理队列（BullMQ）
    ↓
Worker 处理
    ├─ 读取相册配置（包含 color_grading）
    ├─ 下载原始图片
    ├─ 应用调色配置（PhotoProcessor.applyColorGrading）
    │   ├─ 基础调整（亮度、对比度、饱和度等）
    │   ├─ 色调调整（高光、阴影等）
    │   └─ 色彩调整（色温、色调、色相等）
    ├─ 应用水印（如果启用）
    ├─ 生成缩略图和预览图
    └─ 上传到存储
    ↓
更新照片状态（status: 'completed'）
```

### 组件设计

#### 1. 调色配置定义 (`services/worker/src/lib/color-grading.ts`)

```typescript
/**
 * 基础调整参数
 */
export interface BasicAdjustments {
  brightness?: number;    // 0.0 - 2.0, 默认 1.0
  contrast?: number;      // -1.0 - 1.0, 默认 0.0
  saturation?: number;   // 0.0 - 2.0, 默认 1.0
  exposure?: number;      // -2.0 - 2.0, 默认 0.0（通过 brightness 模拟）
  gamma?: number;        // 0.1 - 3.0, 默认 1.0
}

/**
 * 色调调整参数
 */
export interface ToneAdjustments {
  highlights?: number;   // -1.0 - 1.0, 默认 0.0（通过 gamma + brightness 模拟）
  shadows?: number;      // -1.0 - 1.0, 默认 0.0（通过 gamma + brightness 模拟）
  whites?: number;       // -1.0 - 1.0, 默认 0.0（通过 contrast 模拟）
  blacks?: number;       // -1.0 - 1.0, 默认 0.0（通过 contrast 模拟）
}

/**
 * 色彩调整参数
 */
export interface ColorAdjustments {
  temperature?: number;  // -100 - 100, 默认 0（色温，通过 tint 或 hue 模拟）
  tint?: number;         // -100 - 100, 默认 0（色调，通过 tint RGB 模拟）
  hue?: number;          // 0 - 360, 默认 0（色相旋转）
  vibrance?: number;     // -1.0 - 1.0, 默认 0.0（自然饱和度）
}

/**
 * RGB 色彩平衡
 */
export interface ColorBalance {
  r?: number;            // -1.0 - 1.0, 默认 0.0（红色通道）
  g?: number;            // -1.0 - 1.0, 默认 0.0（绿色通道）
  b?: number;            // -1.0 - 1.0, 默认 0.0（蓝色通道）
}

/**
 * 完整调色配置
 */
export interface ColorGradingConfig {
  preset?: string;              // 预设名称（可选，用于快捷应用）
  basic?: BasicAdjustments;     // 基础调整
  tone?: ToneAdjustments;       // 色调调整
  color?: ColorAdjustments;     // 色彩调整
  colorBalance?: ColorBalance;  // RGB 色彩平衡
}

/**
 * 风格预设（作为调色配置的快捷方式）
 */
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  config: ColorGradingConfig;   // 完整的调色配置
  cssFilter?: string;           // 用于前端预览的 CSS filter（部分参数）
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  // ========== 人物风格 ==========
  'japanese-fresh': {
    id: 'japanese-fresh',
    name: '日系小清新',
    category: 'portrait',
    description: '温暖柔和的光线，温柔清新的氛围，适合人像摄影',
    config: {
      brightness: 1.05,
      contrast: -0.1,
      saturation: 0.9,
      gamma: 1.05,
      hue: 10,
      tint: { r: 255, g: 250, b: 245 }
    },
    cssFilter: 'brightness(1.05) contrast(0.9) saturate(0.9) hue-rotate(10deg)'
  },
  'film-portrait': {
    id: 'film-portrait',
    name: '胶片人像',
    category: 'portrait',
    description: '模拟胶片质感，增强层次感和故事性',
    config: {
      brightness: 1.0,
      contrast: 0.15,
      saturation: 1.1,
      gamma: 1.1,
      hue: 5,
      tint: { r: 255, g: 252, b: 248 }
    },
    cssFilter: 'brightness(1.0) contrast(1.15) saturate(1.1) hue-rotate(5deg)'
  },
  'cinematic-portrait': {
    id: 'cinematic-portrait',
    name: '电影感人像',
    category: 'portrait',
    description: '电影级调色，柔和的高光和暖色调，适合浪漫场景',
    config: {
      brightness: 0.95,
      contrast: 0.25,
      saturation: 0.85,
      gamma: 1.15,
      hue: 15,
      tint: { r: 255, g: 248, b: 240 }
    },
    cssFilter: 'brightness(0.95) contrast(1.25) saturate(0.85) hue-rotate(15deg)'
  },
  'realistic-portrait': {
    id: 'realistic-portrait',
    name: '写实人像',
    category: 'portrait',
    description: '保留真实色彩和细节，突出皮肤透明度和纹理',
    config: {
      brightness: 1.02,
      contrast: 0.1,
      saturation: 1.05,
      gamma: 1.0,
      hue: 0
    },
    cssFilter: 'brightness(1.02) contrast(1.1) saturate(1.05)'
  },
  'warm-portrait': {
    id: 'warm-portrait',
    name: '温暖人像',
    category: 'portrait',
    description: '温暖的色调，适合人像和室内拍摄',
    config: {
      brightness: 1.05,
      saturation: 1.1,
      gamma: 1.05,
      hue: 10,
      tint: { r: 255, g: 250, b: 245 }
    },
    cssFilter: 'brightness(1.05) saturate(1.1) hue-rotate(10deg)'
  },
  
  // ========== 风景风格 ==========
  'natural-landscape': {
    id: 'natural-landscape',
    name: '自然风光',
    category: 'landscape',
    description: '保留自然色彩平衡，强调原始质感',
    config: {
      brightness: 1.0,
      contrast: 0.1,
      saturation: 1.15,
      gamma: 1.0,
      hue: 0
    },
    cssFilter: 'brightness(1.0) contrast(1.1) saturate(1.15)'
  },
  'cinematic-landscape': {
    id: 'cinematic-landscape',
    name: '电影感风光',
    category: 'landscape',
    description: '电影级调色，独特的色调和情绪化氛围',
    config: {
      brightness: 0.95,
      contrast: 0.3,
      saturation: 0.9,
      gamma: 1.2,
      hue: 5,
      tint: { r: 255, g: 250, b: 245 }
    },
    cssFilter: 'brightness(0.95) contrast(1.3) saturate(0.9) hue-rotate(5deg)'
  },
  'film-landscape': {
    id: 'film-landscape',
    name: '胶片风光',
    category: 'landscape',
    description: '模拟35mm胶片复古美学，具有颗粒纹理感',
    config: {
      brightness: 1.0,
      contrast: 0.2,
      saturation: 1.1,
      gamma: 1.1,
      hue: 8,
      tint: { r: 255, g: 252, b: 248 }
    },
    cssFilter: 'brightness(1.0) contrast(1.2) saturate(1.1) hue-rotate(8deg)'
  },
  'vibrant-landscape': {
    id: 'vibrant-landscape',
    name: '鲜艳风光',
    category: 'landscape',
    description: '增强色彩饱和度，明亮鲜艳',
    config: {
      brightness: 1.1,
      saturation: 1.3,
      contrast: 0.1,
      gamma: 1.0
    },
    cssFilter: 'brightness(1.1) saturate(1.3) contrast(1.1)'
  },
  'golden-hour': {
    id: 'golden-hour',
    name: '黄金时刻',
    category: 'landscape',
    description: '暖色调和金色色调，适合日落和黄金时段',
    config: {
      brightness: 1.05,
      saturation: 1.2,
      gamma: 1.05,
      hue: 20,
      tint: { r: 255, g: 245, b: 235 }
    },
    cssFilter: 'brightness(1.05) saturate(1.2) hue-rotate(20deg)'
  },
  
  // ========== 通用风格 ==========
  'black-white': {
    id: 'black-white',
    name: '黑白',
    category: 'general',
    description: '经典黑白效果',
    config: {
      saturation: 0,
      contrast: 0.2,
      brightness: 1.0
    },
    cssFilter: 'grayscale(1) contrast(1.2)'
  },
  'vintage': {
    id: 'vintage',
    name: '复古',
    category: 'general',
    description: '温暖的复古色调，增强对比度和饱和度',
    config: {
      brightness: 1.05,
      contrast: 0.15,
      saturation: 1.1,
      hue: 15,
      gamma: 1.1
    },
    cssFilter: 'brightness(1.05) contrast(1.15) saturate(1.1) hue-rotate(15deg)'
  },
  'cool': {
    id: 'cool',
    name: '冷色调',
    category: 'general',
    description: '清爽的冷色调',
    config: {
      brightness: 1.0,
      saturation: 0.9,
      hue: -10
    },
    cssFilter: 'brightness(1.0) saturate(0.9) hue-rotate(-10deg)'
  }
};

/**
 * 按分类获取预设
 */
export function getPresetsByCategory(category: 'portrait' | 'landscape' | 'general'): StylePreset[] {
  return Object.values(STYLE_PRESETS).filter(preset => preset.category === category);
}

/**
 * 获取所有预设（按分类排序）
 */
export function getAllPresets(): StylePreset[] {
  const order = ['portrait', 'landscape', 'general'];
  return Object.values(STYLE_PRESETS).sort((a, b) => {
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
}
```

#### 2. PhotoProcessor 扩展 (`services/worker/src/processor.ts`)

```typescript
import { STYLE_PRESETS, type StylePresetConfig } from '../lib/style-presets';

class PhotoProcessor {
  /**
   * 应用风格预设（简化版，只支持预设选择）
   */
  private applyStylePreset(
    image: sharp.Sharp,
    presetId: string | null | undefined
  ): sharp.Sharp {
    // 如果未选择预设或选择"无风格"，直接返回原图
    if (!presetId || presetId === 'none') {
      return image;
    }

    // 获取预设配置
    const preset = STYLE_PRESETS[presetId];
    if (!preset) {
      console.warn(`[StylePreset] Unknown preset: ${presetId}, skipping`);
      return image;
    }

    const config = preset.config;
    let processedImage = image.clone();

    // 应用 modulate（亮度、饱和度、色相）
    if (config.brightness !== undefined || 
        config.saturation !== undefined || 
        config.hue !== undefined) {
      processedImage = processedImage.modulate({
        brightness: config.brightness ?? 1.0,
        saturation: config.saturation ?? 1.0,
        hue: config.hue ?? 0,
      });
    }

    // 应用对比度
    if (config.contrast !== undefined && config.contrast !== 0) {
      processedImage = processedImage.contrast(config.contrast);
    }

    // 应用伽马校正
    if (config.gamma !== undefined && config.gamma !== 1.0) {
      processedImage = processedImage.gamma(config.gamma);
    }

    // 应用色调叠加（用于色温模拟）
    if (config.tint) {
      processedImage = processedImage.tint(config.tint);
    }

    return processedImage;
  }

  async process(
    watermarkConfig?: WatermarkConfig,
    manualRotation?: number | null,
    stylePresetId?: string | null  // 简化为只传预设 ID
  ): Promise<ProcessedResult> {
    // ... 现有代码 ...

    // 应用旋转
    let rotatedImage: sharp.Sharp;
    if (manualRotation !== null && manualRotation !== undefined) {
      rotatedImage = this.image.clone().rotate().rotate(manualRotation);
    } else {
      rotatedImage = this.image.clone().rotate();
    }

    // 应用风格预设（在旋转之后，水印之前）
    rotatedImage = this.applyStylePreset(rotatedImage, stylePresetId);

    // ... 后续处理（生成缩略图、预览图、水印等）...
  }
}

  async process(
    watermarkConfig?: WatermarkConfig,
    manualRotation?: number | null,
    styleConfig?: StylePresetConfig | null
  ): Promise<ProcessedResult> {
    // ... 现有代码 ...

    // 应用旋转
    let rotatedImage: sharp.Sharp;
    if (manualRotation !== null && manualRotation !== undefined) {
      rotatedImage = this.image.clone().rotate().rotate(manualRotation);
    } else {
      rotatedImage = this.image.clone().rotate();
    }

    // 应用风格预设（在旋转之后，水印之前）
    rotatedImage = this.applyStylePreset(rotatedImage, styleConfig);

    // ... 后续处理（生成缩略图、预览图、水印等）...
  }
}
```

#### 3. Worker 集成 (`services/worker/src/index.ts`)

```typescript
// 在 Worker 处理逻辑中
const album = await getAlbum(albumId);

// 读取风格预设 ID（简化：只存储预设 ID）
const colorGrading = album?.color_grading as { preset?: string } | null;
const stylePresetId = colorGrading?.preset || null;

// 传递给 PhotoProcessor（只传预设 ID）
const processor = new PhotoProcessor(processingBuffer);
const result = await processor.process(watermarkConfig, photoRotation, stylePresetId);
```

---

## API 设计

### 1. 获取风格预设列表

```
GET /api/admin/style-presets
```

**响应：**
```json
{
  "presets": [
    {
      "id": "vintage",
      "name": "复古",
      "description": "温暖的复古色调",
      "cssFilter": "brightness(1.05) contrast(1.15) saturate(1.1) hue-rotate(15deg)"
    },
    ...
  ]
}
```

### 2. 更新相册风格

```
PATCH /api/admin/albums/[id]
```

**请求体：**
```json
{
  "color_grading": {
    "preset": "japanese-fresh"  // 预设 ID
  }
}
```

**移除风格：**
```json
{
  "color_grading": null
}
```

### 3. 预览调色效果（局部渲染）

```
POST /api/admin/albums/[id]/preview-color-grading
```

**请求体：**
```json
{
  "color_grading": {
    "preset": "vintage",
    "basic": { ... },
    "tone": { ... },
    "color": { ... }
  },
  "sample_count": 3  // 可选，默认 3，处理前 N 张照片作为预览
}
```

**响应：**
```json
{
  "preview_images": [
    {
      "photo_id": "uuid",
      "preview_url": "https://...",
      "thumbnail_url": "https://..."
    },
    ...
  ]
}
```

**用途：** 在启动全量重新处理前，先处理样本照片让用户预览效果。

### 4. 重新处理相册照片（应用新调色）

```
POST /api/admin/albums/[id]/reprocess
```

**请求体：**
```json
{
  "apply_color_grading": true  // 可选，默认 true
}
```

**响应：**
```json
{
  "job_id": "uuid",
  "total_photos": 25,
  "estimated_time": "2-3 分钟"
}
```

---

## 前端设计

### 1. 管理员操作流程

#### 场景一：创建新相册时选择风格（可选）

**步骤：**
1. 管理员点击"创建相册"按钮
2. 填写基本信息（标题、描述等）
3. **可选**：在"调色设置"部分选择风格
   - 默认：无风格（不选择）
   - 可选：选择预设风格（如"复古"、"电影感"）
   - 可选：展开"专业模式"，手动调整参数
4. 实时预览效果（使用示例图片 + CSS 滤镜）
5. 点击"创建相册"
6. 如果选择了风格，后续上传的照片会自动应用调色配置
7. 如果没有选择风格，相册保持原始色彩（`color_grading = null`）

**UI 设计：**
```
┌─────────────────────────────────────┐
│ 新建相册                             │
├─────────────────────────────────────┤
│ 基本信息                              │
│ [标题输入框]                         │
│ [描述输入框]                         │
│                                      │
│ 调色设置（可选）⭐                    │
│ ┌─────────────────────────────────┐ │
│ │ ○ 无风格（默认）                  │ │
│ │ ○ 复古 [预览图]                   │ │
│ │ ○ 电影感 [预览图]                 │ │
│ │ ○ 鲜艳 [预览图]                   │ │
│ │ ...                               │ │
│ │                                    │ │
│ │ [展开专业模式 ▼]                   │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [创建相册] [取消]                    │
└─────────────────────────────────────┘
```

**关键点：**
- ✅ 风格选择是**可选的**，可以不选择
- ✅ 默认选择"无风格"
- ✅ 选择风格后可以预览效果
- ✅ 创建后可以随时在设置页面切换风格

#### 场景二：为已有相册设置/修改调色

**步骤：**
1. 管理员进入相册详情页
2. 点击"设置"按钮（或访问 `/admin/albums/[id]/settings`）
3. 在设置页面找到"调色设置"部分
4. 选择预设或自定义参数
5. 实时预览效果
6. 点击"保存设置"
7. **重要提示**：系统会询问是否重新处理已上传的照片
   - 选择"是"：后台异步重新处理所有照片（可能需要几分钟）
   - 选择"否"：仅对新上传的照片生效

#### 场景三：基于预设微调

**步骤：**
1. 选择预设风格（如"复古"）
2. 点击"自定义"按钮，展开详细参数
3. 在预设基础上微调参数（如亮度 +5%、对比度 +10%）
4. 实时预览效果
5. 保存设置

### 2. 调色设置界面设计

**位置：** `apps/web/src/components/admin/album-settings-form.tsx`（集成到相册设置表单）

**UI 布局：**

```
┌─────────────────────────────────────────────────────────┐
│ 相册设置                                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 基本信息                                                  │
│ ┌────────────────────────────────────────────────────┐ │
│ │ 标题、描述、日期等...                                │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ 调色设置 ⭐ 新增                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 【人物风格】                                        │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│ │ │日系小清新│ │胶片人像  │ │电影感人像│ │写实人像  │ │ │
│ │ │  [预览]  │ │  [预览]  │ │  [预览]  │ │  [预览]  │ │ │
│ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│ │ ┌──────────┐                                        │ │
│ │ │温暖人像  │                                        │ │
│ │ │  [预览]  │                                        │ │
│ │ └──────────┘                                        │ │
│ │                                                     │ │
│ │ 【风景风格】                                        │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│ │ │自然风光  │ │电影感风光│ │胶片风光  │ │黄金时刻  │ │ │
│ │ │  [预览]  │ │  [预览]  │ │  [预览]  │ │  [预览]  │ │ │
│ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│ │ ┌──────────┐                                        │ │
│ │ │鲜艳风光  │                                        │ │
│ │ │  [预览]  │                                        │ │
│ │ └──────────┘                                        │ │
│ │                                                     │ │
│ │ 【通用风格】                                        │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐            │ │
│ │ │  黑白    │ │  复古    │ │ 冷色调   │            │ │
│ │ │  [预览]  │ │  [预览]  │ │  [预览]  │            │ │
│ │ └──────────┘ └──────────┘ └──────────┘            │ │
│ │                                                     │ │
│ │ 【实时预览】                                        │ │
│ │ ┌────────────┐  ┌────────────┐                   │ │
│ │ │  原图      │  │  调色后    │                   │ │
│ │ │  [图片]    │  │  [图片]    │                   │ │
│ │ └────────────┘  └────────────┘                   │ │
│ │                                                     │ │
│ │ 当前选择：日系小清新                                │ │
│ │                                                     │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ 其他设置（水印、布局等）...                              │
│                                                          │
│ [保存设置] [取消]                                        │
└─────────────────────────────────────────────────────────┘
```

### 3. 调色组件设计

**组件：** `apps/web/src/components/admin/color-grading-panel.tsx`

**功能特性（简化版）：**
- **预设选择器**：按分类展示（人物/风景/通用），网格布局
- **预设卡片**：显示预览图、名称、描述
- **实时预览**：使用 CSS 滤镜，无需重新处理图片
- **长按对比**：长按预览图可查看原图对比
- **保存提示**：如果相册已有照片，提示是否需要重新处理

**代码结构（简化版）：**
```tsx
interface StylePresetSelectorProps {
  value: string | null;  // 预设 ID 或 null（无风格）
  onChange: (presetId: string | null) => void;
  previewImage?: string; // 用于预览的示例图片
}

export function StylePresetSelector({ value, onChange, previewImage }: StylePresetSelectorProps) {
  const portraitPresets = getPresetsByCategory('portrait');
  const landscapePresets = getPresetsByCategory('landscape');
  const generalPresets = getPresetsByCategory('general');
  
  // 选择预设
  const handlePresetSelect = (presetId: string | null) => {
    onChange(presetId);
  };
  
  // 生成 CSS 滤镜用于预览
  const cssFilter = useMemo(() => {
    if (!value) return 'none';
    const preset = STYLE_PRESETS[value];
    return preset?.cssFilter || 'none';
  }, [value]);
  
  return (
    <div className="style-preset-selector">
      {/* 人物风格 */}
      <PresetCategory 
        title="人物风格"
        presets={portraitPresets}
        selected={value}
        onSelect={handlePresetSelect}
      />
      
      {/* 风景风格 */}
      <PresetCategory 
        title="风景风格"
        presets={landscapePresets}
        selected={value}
        onSelect={handlePresetSelect}
      />
      
      {/* 通用风格 */}
      <PresetCategory 
        title="通用风格"
        presets={generalPresets}
        selected={value}
        onSelect={handlePresetSelect}
      />
      
      {/* 实时预览 */}
      {previewImage && (
        <PreviewImage 
          src={previewImage}
          filter={cssFilter}
          showOriginalOnHold={true}  // 长按对比原图
        />
      )}
    </div>
  );
}
```

### 4. 保存和重新处理流程

**保存调色配置：**
```typescript
// 1. 用户点击"保存设置"
const handleSave = async () => {
  // 2. 准备配置（如果选择"无风格"，传 null）
  const colorGradingConfig = selectedPreset === 'none' 
    ? null 
    : colorGradingConfig;
  
  // 3. 调用 API 更新相册配置
  const response = await fetch(`/api/admin/albums/${albumId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      color_grading: colorGradingConfig  // 可以是 null（移除风格）
    })
  });
  
  // 4. 如果相册已有照片，询问是否重新处理
  if (album.photo_count > 0) {
    const shouldReprocess = await showConfirmDialog({
      title: colorGradingConfig ? '应用新风格' : '移除风格',
      message: colorGradingConfig
        ? `相册中有 ${album.photo_count} 张照片，是否重新处理以应用新的调色配置？`
        : `相册中有 ${album.photo_count} 张照片，是否重新处理以移除调色效果？`,
      confirmText: '重新处理',
      cancelText: '仅对新照片生效'
    });
    
    if (shouldReprocess) {
      // 5. 触发重新处理任务
      await fetch(`/api/admin/albums/${albumId}/reprocess`, {
        method: 'POST',
        body: JSON.stringify({ apply_color_grading: true })
      });
      
      showSuccess(
        colorGradingConfig 
          ? '调色配置已保存，照片正在后台重新处理...'
          : '风格已移除，照片正在后台重新处理...'
      );
    } else {
      showSuccess(
        colorGradingConfig
          ? '调色配置已保存，将应用于新上传的照片'
          : '风格已移除，新上传的照片将保持原始色彩'
      );
    }
  } else {
    showSuccess(
      colorGradingConfig 
        ? '调色配置已保存'
        : '风格已移除'
    );
  }
};
```

**重新处理提示界面：**

**场景 A：应用新风格**
```
┌─────────────────────────────────────┐
│ 应用新风格？                          │
├─────────────────────────────────────┤
│                                      │
│ 相册中有 25 张照片                    │
│ 当前风格：复古                        │
│ 新风格：电影感                        │
│                                      │
│ 选择重新处理：                        │
│ • 所有照片将应用新的调色配置           │
│ • 处理时间约 1-3 分钟                 │
│ • 可在后台异步处理                    │
│                                      │
│ 选择仅对新照片生效：                  │
│ • 已上传的照片保持原样                │
│ • 新上传的照片会应用调色配置           │
│                                      │
│ [重新处理] [仅对新照片生效] [取消]    │
└─────────────────────────────────────┘
```

**场景 B：移除风格**
```
┌─────────────────────────────────────┐
│ 移除风格？                            │
├─────────────────────────────────────┤
│                                      │
│ 相册中有 25 张照片                    │
│ 当前风格：复古                        │
│                                      │
│ 选择重新处理：                        │
│ • 所有照片将恢复原始色彩               │
│ • 处理时间约 1-3 分钟                 │
│ • 可在后台异步处理                    │
│                                      │
│ 选择仅对新照片生效：                  │
│ • 已上传的照片保持当前风格             │
│ • 新上传的照片将保持原始色彩           │
│                                      │
│ [重新处理] [仅对新照片生效] [取消]    │
└─────────────────────────────────────┘
```

### 2. 前端预览实现

**CSS 滤镜映射：**

```typescript
// apps/web/src/lib/style-preset-utils.ts
export function getStylePresetCSSFilter(
  preset: StylePresetConfig | null
): string {
  if (!preset || preset.preset === 'none' || !preset.preset) {
    return 'none';
  }

  const config = preset.preset === 'custom' 
    ? preset.custom 
    : STYLE_PRESETS[preset.preset]?.config;

  if (!config) {
    return 'none';
  }

  const filters: string[] = [];

  if (config.brightness !== undefined) {
    filters.push(`brightness(${config.brightness})`);
  }
  if (config.contrast !== undefined) {
    filters.push(`contrast(${1 + config.contrast})`);
  }
  if (config.saturation !== undefined) {
    filters.push(`saturate(${config.saturation})`);
  }
  if (config.hue !== undefined) {
    filters.push(`hue-rotate(${config.hue}deg)`);
  }
  if (config.saturation === 0) {
    filters.push('grayscale(1)');
  }

  return filters.join(' ') || 'none';
}
```

**使用示例：**
```tsx
<img 
  src={photo.preview_url} 
  style={{ 
    filter: getStylePresetCSSFilter(album.color_grading) 
  }} 
/>
```

**进阶功能：长按对比原图**

在预览面板中增加"长按对比原图"功能，提升调色体验：

```tsx
// apps/web/src/components/admin/color-grading-preview.tsx
export function ColorGradingPreview({ 
  imageUrl, 
  filter 
}: { 
  imageUrl: string; 
  filter: string 
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  
  return (
    <div 
      className="relative"
      onMouseDown={() => setShowOriginal(true)}
      onMouseUp={() => setShowOriginal(false)}
      onMouseLeave={() => setShowOriginal(false)}
      onTouchStart={() => setShowOriginal(true)}
      onTouchEnd={() => setShowOriginal(false)}
    >
      <img 
        src={imageUrl}
        alt="调色预览"
        className="w-full h-auto"
        style={{ 
          filter: showOriginal ? 'none' : filter,
          transition: 'filter 0.1s ease-out'
        }} 
      />
      {showOriginal && (
        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
          原图
        </div>
      )}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm text-xs">
        长按查看原图
      </div>
    </div>
  );
}
```

**优势：**
- ✅ 提升调色体验，方便对比效果
- ✅ 实现简单，无需额外 API
- ✅ 移动端和桌面端都支持

---

## 实现计划

### 阶段一：核心功能（MVP）

1. ✅ 创建风格预设定义文件（13 个预设：5 人物 + 5 风景 + 3 通用）
2. ✅ 扩展数据库 schema（添加 `color_grading` 字段，只存储预设 ID）
3. ✅ 实现 `PhotoProcessor.applyStylePreset()` 方法（简化版）
4. ✅ Worker 集成风格处理（读取预设 ID，传递给 Processor）
5. ✅ API：获取预设列表、更新相册风格

### 阶段二：前端界面

6. ✅ 创建风格选择器组件（按分类展示）
7. ✅ 在创建相册对话框集成（可选）
8. ✅ 在相册设置页面集成
9. ✅ 实现 CSS 滤镜预览
10. ✅ 长按对比原图功能

### 阶段三：优化和测试

11. ⏳ 批量重新处理功能
12. ⏳ JSON Schema 校验（三层防护）
13. ⏳ 性能测试和优化
14. ⏳ 单元测试和集成测试
15. ⏳ 文档更新

---

## 性能考虑

### 处理时间影响

- **基准**：当前图片处理时间约 500-2000ms（取决于图片大小）
- **预期增加**：风格处理预计增加 50-200ms（< 20%）
- **优化措施**：
  - 风格处理在内存中进行，无需额外 I/O
  - 复用 Sharp pipeline，减少 clone 操作
  - 并行处理多个操作（modulate、contrast 等）

### 存储空间

- **影响**：风格处理不改变图片尺寸，存储空间不变
- **考虑**：如果未来支持原图风格处理，需要额外存储空间

### 前端性能

- **CSS 滤镜**：现代浏览器硬件加速，性能良好
- **预览图**：使用现有预览图，无需额外请求

---

## 测试计划

### 单元测试

1. **风格预设定义测试**
   - 验证所有预设配置有效
   - 验证 CSS 滤镜字符串生成正确

2. **PhotoProcessor 测试**
   - 测试 `applyStylePreset()` 方法
   - 验证各种预设效果
   - 测试自定义参数

### 集成测试

1. **Worker 处理流程**
   - 上传照片并应用风格
   - 验证生成的图片包含风格效果
   - 测试未配置风格的相册（向后兼容）

2. **API 测试**
   - 测试风格预设列表 API
   - 测试相册风格更新 API
   - 测试重新处理 API

### 视觉测试

1. **效果验证**
   - 对比原始图片和处理后图片
   - 验证各预设效果符合预期
   - 测试极端参数值

2. **浏览器兼容性**
   - 测试 CSS 滤镜在各浏览器表现
   - 验证预览效果一致性

---

## 后续优化方向

### 已规划功能

1. **AI 风格推荐**：根据照片内容自动推荐合适风格
2. **风格学习**：允许用户上传参考图片，学习并应用风格
3. **批量风格切换**：支持为多个相册批量应用风格
4. **风格市场**：社区分享自定义风格预设

### 进阶功能建议

#### 方案 A：长按对比原图（推荐）

**功能描述：**
在预览面板中，长按图片可临时显示原图，松开后恢复调色效果。

**实现方案：**
```tsx
// 前端实现
<div 
  className="preview-image-container"
  onMouseDown={() => setShowOriginal(true)}
  onMouseUp={() => setShowOriginal(false)}
  onMouseLeave={() => setShowOriginal(false)}
  onTouchStart={() => setShowOriginal(true)}
  onTouchEnd={() => setShowOriginal(false)}
>
  <img 
    src={previewImage} 
    style={{ 
      filter: showOriginal ? 'none' : cssFilter 
    }} 
  />
  {showOriginal && (
    <div className="overlay-label">原图</div>
  )}
</div>
```

**优势：**
- ✅ 提升调色体验，方便对比效果
- ✅ 实现简单，无需额外 API
- ✅ 移动端和桌面端都支持

**适用场景：**
- 微调参数时快速对比
- 向客户展示调色效果

---

#### 方案 B：局部渲染预览（推荐）

**功能描述：**
对于已有照片的相册，重新处理前先处理前 3 张照片并展示预览，用户确认满意后再启动全量异步任务。

**实现方案：**

**前端流程：**
```typescript
// 1. 用户保存调色配置
const handleSave = async () => {
  // 2. 如果相册有照片，先处理预览样本
  if (album.photo_count > 0) {
    // 3. 调用预览 API（处理前 3 张）
    const previewResult = await fetch(`/api/admin/albums/${albumId}/preview-color-grading`, {
      method: 'POST',
      body: JSON.stringify({ 
        color_grading: config,
        sample_count: 3  // 处理前 3 张
      })
    });
    
    const { preview_images } = await previewResult.json();
    
    // 4. 显示预览对话框
    const confirmed = await showPreviewDialog({
      title: '调色效果预览',
      images: preview_images,  // 显示处理后的预览图
      message: `已处理 3 张样本照片，确认效果后将继续处理剩余的 ${album.photo_count - 3} 张照片`
    });
    
    if (confirmed) {
      // 5. 用户确认后，启动全量处理
      await startFullReprocessing();
    }
  }
};
```

**后端实现：**
```typescript
// API: POST /api/admin/albums/[id]/preview-color-grading
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { color_grading, sample_count = 3 } = await request.json();
  
  // 1. 获取相册的前 N 张照片
  const photos = await supabase
    .from('photos')
    .select('id, preview_key')
    .eq('album_id', id)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(sample_count);
  
  // 2. 创建临时处理任务（同步处理）
  const previewJobs = photos.map(photo => ({
    photoId: photo.id,
    colorGrading: color_grading,
    isPreview: true  // 标记为预览，不更新数据库
  }));
  
  // 3. 处理并返回预览图 URL
  const previewImages = await Promise.all(
    previewJobs.map(async (job) => {
      const processedImage = await processPhotoWithColorGrading(job);
      return {
        photoId: job.photoId,
        previewUrl: processedImage.previewUrl,
        thumbnailUrl: processedImage.thumbnailUrl
      };
    })
  );
  
  return NextResponse.json({ preview_images: previewImages });
}
```

**优势：**
- ✅ 避免全量处理后发现效果不满意
- ✅ 提升用户体验，减少等待时间
- ✅ 节省服务器资源

**注意事项：**
- 预览处理是同步的，需要设置超时（如 30 秒）
- 如果样本照片处理失败，提示用户但仍允许继续

---

#### LUT 支持（未来扩展）

**功能描述：**
支持上传 `.cube` (LUT) 文件，这是专业调色的通用标准。Sharp 可以通过三维查找表实现比 `modulate` 更精准的效果。

**技术方案：**

**1. LUT 文件格式：**
```
# LUT 3D size 64
# 64x64x64 三维查找表
0.000000 0.000000 0.000000
0.015625 0.000000 0.000000
...
```

**2. Sharp 实现：**
```typescript
// Sharp 不直接支持 LUT，需要通过以下方式实现：
// 方案 A：使用 Sharp 的 pipelineColourspace + 自定义处理
// 方案 B：使用 imagemagick（需要额外依赖）
// 方案 C：使用 WebGL/Canvas 在浏览器端处理（仅预览）

// 推荐方案：服务端使用 imagemagick 或自定义 LUT 处理库
import { applyLUT } from './lut-processor';

const processedImage = await applyLUT(imageBuffer, lutFile);
```

**3. 数据库扩展：**
```sql
-- 在 color_grading JSONB 中添加 LUT 字段
-- color_grading: {
--   "preset": "custom",
--   "lut": {
--     "enabled": true,
--     "file_id": "uuid",  // LUT 文件存储在 storage
--     "intensity": 1.0    // LUT 强度（0.0 - 1.0），支持混合
--   },
--   "basic": { ... },
--   ...
-- }
```

**4. 实现步骤：**
1. 创建 LUT 文件上传 API
2. 解析 `.cube` 文件格式
3. 实现 LUT 处理函数（使用 imagemagick 或自定义算法）
4. 在 PhotoProcessor 中集成 LUT 处理
5. 支持 LUT + 参数调色混合（通过 intensity 参数）

**优势：**
- ✅ 专业调色标准，效果更精准
- ✅ 支持导入专业调色预设
- ✅ 可与参数调色混合使用

**挑战：**
- ⚠️ Sharp 不直接支持，需要额外库或自定义实现
- ⚠️ LUT 文件处理性能开销较大
- ⚠️ 需要文件存储和管理

**推荐优先级：** 中低（先完善基础调色功能）

---

#### JSON Schema 校验（重要）

**功能描述：**
在数据库层面为 `color_grading` JSONB 字段设置 JSON Schema 校验，防止前端传错参数范围导致后端 Sharp 报错。

**实现方案：**

**1. PostgreSQL JSON Schema 校验（PostgreSQL 14+）：**
```sql
-- 创建校验函数
CREATE OR REPLACE FUNCTION validate_color_grading(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- 检查基本结构
  IF config IS NULL THEN
    RETURN TRUE;  -- NULL 是允许的（表示无调色）
  END IF;
  
  -- 验证基础调整参数范围
  IF config->'basic' IS NOT NULL THEN
    IF (config->'basic'->>'brightness')::numeric < 0.0 OR 
       (config->'basic'->>'brightness')::numeric > 2.0 THEN
      RETURN FALSE;
    END IF;
    IF (config->'basic'->>'contrast')::numeric < -1.0 OR 
       (config->'basic'->>'contrast')::numeric > 1.0 THEN
      RETURN FALSE;
    END IF;
    -- ... 其他参数校验
  END IF;
  
  -- 验证色调调整参数范围
  IF config->'tone' IS NOT NULL THEN
    IF (config->'tone'->>'highlights')::numeric < -1.0 OR 
       (config->'tone'->>'highlights')::numeric > 1.0 THEN
      RETURN FALSE;
    END IF;
    -- ... 其他参数校验
  END IF;
  
  -- 验证色彩调整参数范围
  IF config->'color' IS NOT NULL THEN
    IF (config->'color'->>'temperature')::integer < -100 OR 
       (config->'color'->>'temperature')::integer > 100 THEN
      RETURN FALSE;
    END IF;
    -- ... 其他参数校验
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 创建 CHECK 约束
ALTER TABLE albums 
ADD CONSTRAINT check_color_grading_valid 
CHECK (validate_color_grading(color_grading));
```

**2. 应用层校验（双重保障）：**
```typescript
// apps/web/src/lib/color-grading-validator.ts
export function validateColorGrading(config: ColorGradingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 验证基础调整
  if (config.basic) {
    if (config.basic.brightness !== undefined) {
      if (config.basic.brightness < 0 || config.basic.brightness > 2) {
        errors.push('亮度必须在 0.0 - 2.0 之间');
      }
    }
    if (config.basic.contrast !== undefined) {
      if (config.basic.contrast < -1 || config.basic.contrast > 1) {
        errors.push('对比度必须在 -1.0 - 1.0 之间');
      }
    }
    // ... 其他参数
  }
  
  // 验证色调调整
  if (config.tone) {
    if (config.tone.highlights !== undefined) {
      if (config.tone.highlights < -1 || config.tone.highlights > 1) {
        errors.push('高光必须在 -1.0 - 1.0 之间');
      }
    }
    // ... 其他参数
  }
  
  // 验证色彩调整
  if (config.color) {
    if (config.color.temperature !== undefined) {
      if (config.color.temperature < -100 || config.color.temperature > 100) {
        errors.push('色温必须在 -100 - 100 之间');
      }
    }
    // ... 其他参数
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 在保存前校验
const validation = validateColorGrading(colorGradingConfig);
if (!validation.valid) {
  showError(`参数校验失败：${validation.errors.join(', ')}`);
  return;
}
```

**3. 后端 API 校验：**
```typescript
// apps/web/src/app/api/admin/albums/[id]/route.ts
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const body = await request.json();
  
  // 如果包含 color_grading，先校验
  if (body.color_grading) {
    const validation = validateColorGrading(body.color_grading);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: validation.errors.join('; ') 
          } 
        },
        { status: 400 }
      );
    }
  }
  
  // ... 继续处理
}
```

**优势：**
- ✅ 数据库层面保障数据完整性
- ✅ 防止恶意或错误数据导致系统崩溃
- ✅ 提供清晰的错误提示

**实现优先级：** 高（应该在 MVP 阶段实现）

---

## 参考资料

- [Sharp API - Colour manipulation](https://sharp.pixelplumbing.com/api-colour)
- [CSS Filter Effects](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)
- [CSSgram - Instagram filters with CSS](https://github.com/una/CSSgram)
- [Pixels.js - Image filters library](https://github.com/silvia-odwyer/pixels.js)

---

## 更新日志

- **2026-01-28**: 初始版本，完成功能设计和技术方案
