'use client'

import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { showInfo } from '@/lib/toast'
import { WatermarkPreview } from './watermark-preview'

export interface WatermarkItem {
  id: string
  type: 'text' | 'logo'
  text?: string
  logoUrl?: string
  opacity: number
  position: string
  size?: number
  margin?: number // 边距（百分比，0-20，默认5）
  enabled?: boolean
}

interface MultiWatermarkManagerProps {
  watermarks: WatermarkItem[]
  onChange: (watermarks: WatermarkItem[]) => void
}

const POSITION_OPTIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'center-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
]

export function MultiWatermarkManager({ watermarks, onChange }: MultiWatermarkManagerProps) {
  const addWatermark = () => {
    if (watermarks.length >= 6) {
      showInfo('最多支持6个水印')
      return
    }

    const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
    const newWatermark: WatermarkItem = {
      id: `watermark-${Date.now()}`,
      type: 'text',
      text: `© ${photographerName}`,
      opacity: 0.5,
      position: 'center',
      margin: 5,
      enabled: true,
    }

    onChange([...watermarks, newWatermark])
  }

  const removeWatermark = (id: string) => {
    onChange(watermarks.filter(w => w.id !== id))
  }

  const updateWatermark = (id: string, updates: Partial<WatermarkItem>) => {
    onChange(
      watermarks.map(w => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  const toggleWatermark = (id: string) => {
    updateWatermark(id, { enabled: !watermarks.find(w => w.id === id)?.enabled })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">多位置水印</p>
          <p className="text-sm text-text-muted">
            最多支持6个水印，可在不同位置同时显示
          </p>
        </div>
        <button
          type="button"
          onClick={addWatermark}
          disabled={watermarks.length >= 6}
          className="btn-secondary text-sm"
        >
          <Plus className="w-4 h-4" />
          添加水印
        </button>
      </div>

      {/* 水印预览 */}
      {watermarks.length > 0 && (
        <div className="card p-4">
          <label className="block text-xs font-medium text-text-secondary mb-3">
            预览效果
          </label>
          <WatermarkPreview watermarks={watermarks} width={600} height={400} />
          <p className="text-xs text-text-muted mt-2">
            蓝色圆点标记水印位置，调整设置可实时查看效果
          </p>
        </div>
      )}

      {watermarks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <p className="text-text-secondary mb-4">还没有添加水印</p>
          <button
            type="button"
            onClick={addWatermark}
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" />
            添加第一个水印
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {watermarks.map((watermark, index) => (
            <div key={watermark.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-secondary">
                    水印 {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWatermark(watermark.id)}
                    className="p-1 hover:bg-surface-elevated rounded transition-colors"
                    title={watermark.enabled ? '禁用' : '启用'}
                  >
                    {watermark.enabled ? (
                      <Eye className="w-4 h-4 text-accent" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                </div>
                {watermarks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWatermark(watermark.id)}
                    className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 水印类型 */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    类型
                  </label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`watermark-type-${watermark.id}`}
                        checked={watermark.type === 'text'}
                        onChange={() => updateWatermark(watermark.id, { type: 'text' })}
                        className="w-4 h-4 text-accent border-border focus:ring-accent"
                      />
                      <span>文字</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`watermark-type-${watermark.id}`}
                        checked={watermark.type === 'logo'}
                        onChange={() => updateWatermark(watermark.id, { type: 'logo' })}
                        className="w-4 h-4 text-accent border-border focus:ring-accent"
                      />
                      <span>Logo</span>
                    </label>
                  </div>
                </div>

                {/* 位置 */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    位置
                  </label>
                  <select
                    value={watermark.position}
                    onChange={(e) => updateWatermark(watermark.id, { position: e.target.value })}
                    className="input text-sm"
                  >
                    {POSITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 文字内容或Logo URL */}
                {watermark.type === 'text' ? (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      文字内容
                    </label>
                    <input
                      type="text"
                      value={watermark.text || ''}
                      onChange={(e) => updateWatermark(watermark.id, { text: e.target.value })}
                      className="input text-sm"
                      placeholder="© Your Name"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={watermark.logoUrl || ''}
                      onChange={(e) => updateWatermark(watermark.id, { logoUrl: e.target.value })}
                      className="input text-sm"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                )}

                {/* 边距和透明度 */}
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      边距 ({watermark.margin ?? 5}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={watermark.margin ?? 5}
                      onChange={(e) =>
                        updateWatermark(watermark.id, { margin: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-text-muted mt-1">调整水印与边缘的距离（0-20%）</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      透明度 ({Math.round((watermark.opacity || 0.5) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={watermark.opacity || 0.5}
                      onChange={(e) =>
                        updateWatermark(watermark.id, { opacity: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
