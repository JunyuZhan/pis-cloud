/**
 * 风格预设工具函数（前端使用）
 */

export interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  cssFilter?: string
}

/**
 * 根据预设 ID 获取 CSS 滤镜字符串
 */
export function getStylePresetCSSFilter(
  colorGrading: { preset?: string } | null | undefined
): string {
  if (!colorGrading || !colorGrading.preset || colorGrading.preset === 'none') {
    return 'none'
  }

  // 预设 ID 到 CSS 滤镜的映射（与 worker 中的定义保持一致）
  const presetFilters: Record<string, string> = {
    'japanese-fresh': 'brightness(1.05) contrast(0.9) saturate(0.9) hue-rotate(10deg)',
    'film-portrait': 'brightness(1.0) contrast(1.15) saturate(1.1) hue-rotate(5deg)',
    'cinematic-portrait': 'brightness(0.95) contrast(1.25) saturate(0.85) hue-rotate(15deg)',
    'realistic-portrait': 'brightness(1.02) contrast(1.1) saturate(1.05)',
    'warm-portrait': 'brightness(1.05) saturate(1.1) hue-rotate(10deg)',
    'natural-landscape': 'brightness(1.0) contrast(1.1) saturate(1.15)',
    'cinematic-landscape': 'brightness(0.95) contrast(1.3) saturate(0.9) hue-rotate(5deg)',
    'film-landscape': 'brightness(1.0) contrast(1.2) saturate(1.1) hue-rotate(8deg)',
    'vibrant-landscape': 'brightness(1.1) saturate(1.3) contrast(1.1)',
    'golden-hour': 'brightness(1.05) saturate(1.2) hue-rotate(20deg)',
    'black-white': 'grayscale(1) contrast(1.2)',
    'vintage': 'brightness(1.05) contrast(1.15) saturate(1.1) hue-rotate(15deg)',
    'cool': 'brightness(1.0) saturate(0.9) hue-rotate(-10deg)',
  }

  return presetFilters[colorGrading.preset] || 'none'
}
