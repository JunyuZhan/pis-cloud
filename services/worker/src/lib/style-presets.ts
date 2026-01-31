/**
 * PIS 风格预设定义
 * 
 * 基于 Lightroom 调色思路，提供简单可靠的预设风格
 * 管理员只需选择预设，无需专业调色知识
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

/**
 * 风格预设配置（基于 Sharp 的参数）
 */
export interface StylePresetConfig {
  brightness?: number;    // 0.0 - 2.0, 默认 1.0
  contrast?: number;      // -1.0 - 1.0, 默认 0.0
  saturation?: number;   // 0.0 - 2.0, 默认 1.0
  gamma?: number;        // 0.1 - 3.0, 默认 1.0
  hue?: number;          // 0 - 360, 默认 0（色相旋转）
  tint?: { r: number; g: number; b: number };  // 色调叠加（用于色温模拟）
}

/**
 * 风格预设
 */
export interface StylePreset {
  id: string;                    // 预设 ID（如 "japanese-fresh"）
  name: string;                  // 预设名称（如 "日系小清新"）
  category: 'portrait' | 'landscape' | 'general';  // 分类：人物/风景/通用
  description: string;           // 描述
  config: StylePresetConfig;      // 调色参数配置
  cssFilter?: string;            // 用于前端预览的 CSS filter
}

/**
 * 风格预设列表（13 个预设）
 */
export const STYLE_PRESETS: Record<string, StylePreset> = {
  // ========== 人物风格（5个）==========
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
  
  // ========== 风景风格（5个）==========
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
  
  // ========== 通用风格（3个）==========
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

/**
 * 根据预设 ID 获取预设
 */
export function getPresetById(presetId: string): StylePreset | undefined {
  return STYLE_PRESETS[presetId];
}
