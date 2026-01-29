'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { getStylePresetCSSFilter } from '@/lib/style-preset-utils'

export interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  cssFilter?: string
}

interface StylePresetSelectorProps {
  value: string | null  // 预设 ID 或 null（无风格）
  onChange: (presetId: string | null) => void
  previewImage?: string  // 用于预览的示例图片 URL
  className?: string
}

export function StylePresetSelector({
  value,
  onChange,
  previewImage,
  className = '',
}: StylePresetSelectorProps) {
  const [presets, setPresets] = useState<StylePreset[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)

  // 加载预设列表
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const res = await fetch('/api/admin/style-presets')
        const data = await res.json()
        if (res.ok) {
          setPresets(data.presets || [])
        }
      } catch (error) {
        console.error('加载预设列表失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPresets()
  }, [])

  // 按分类分组预设
  const presetsByCategory = useMemo(() => {
    const portrait = presets.filter(p => p.category === 'portrait')
    const landscape = presets.filter(p => p.category === 'landscape')
    const general = presets.filter(p => p.category === 'general')
    return { portrait, landscape, general }
  }, [presets])

  // 获取当前选择的预设 CSS 滤镜
  const currentFilter = useMemo(() => {
    return getStylePresetCSSFilter(value ? { preset: value } : null)
  }, [value])

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-sm text-text-muted">加载预设列表...</div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 无风格选项 */}
      <div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-full p-4 rounded-lg border-2 transition-all text-left min-h-[44px] active:scale-[0.98] touch-manipulation ${
            value === null
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 active:bg-surface-elevated'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">无风格</div>
              <div className="text-sm text-text-muted mt-1">保持原始色彩</div>
            </div>
            {value === null && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </div>
        </button>
      </div>

      {/* 人物风格 */}
      {presetsByCategory.portrait.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">人物风格</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presetsByCategory.portrait.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 风景风格 */}
      {presetsByCategory.landscape.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">风景风格</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presetsByCategory.landscape.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 通用风格 */}
      {presetsByCategory.general.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">通用风格</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presetsByCategory.general.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 实时预览 */}
      {previewImage && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">实时预览</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-text-muted mb-2">原图</div>
              <div
                className="relative aspect-video bg-surface rounded-lg overflow-hidden border border-border touch-manipulation select-none"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                role="button"
                tabIndex={0}
                aria-label="长按查看原图"
              >
                <Image
                  src={previewImage}
                  alt="原图"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  unoptimized
                />
                {showOriginal && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    原图
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted mb-2">调色后</div>
              <div className="relative aspect-video bg-surface rounded-lg overflow-hidden border border-border">
                <Image
                  src={previewImage}
                  alt="调色后"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  style={{
                    filter: currentFilter,
                    transition: 'filter 0.2s ease-out',
                  }}
                  unoptimized
                />
                {value && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {presets.find(p => p.id === value)?.name || '已选择'}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2 text-center sm:text-left">
            💡 长按左侧原图可对比效果
          </p>
        </div>
      )}
    </div>
  )
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: StylePreset
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-3 rounded-lg border-2 transition-all text-left min-h-[44px] active:scale-[0.98] touch-manipulation ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/50 active:bg-surface-elevated'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm">{preset.name}</div>
          {selected && (
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="text-xs text-text-muted line-clamp-2">
          {preset.description}
        </div>
      </div>
    </button>
  )
}
