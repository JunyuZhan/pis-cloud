'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']

interface AlbumSettingsFormProps {
  album: Album
}

export function AlbumSettingsForm({ album }: AlbumSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: album.title,
    description: album.description || '',
    is_public: album.is_public ?? false,
    layout: album.layout || 'masonry',
    sort_rule: album.sort_rule || 'capture_desc',
    allow_download: album.allow_download ?? false,
    show_exif: album.show_exif ?? true,
    watermark_enabled: album.watermark_enabled ?? false,
    watermark_type: album.watermark_type || 'text',
    watermark_config: (album.watermark_config as any) || {
      text: '© PIS Photography',
      opacity: 0.5,
      position: 'center',
    },
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleWatermarkConfigChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      watermark_config: { ...prev.watermark_config, [field]: value },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('保存失败')

      router.refresh()
      // 可以添加一个 toast 提示成功
      alert('设置已保存')
    } catch (error) {
      console.error(error)
      alert('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 基本信息 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-medium">基本信息</h2>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            相册标题
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            相册描述
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="input min-h-[100px] resize-none"
          />
        </div>
      </section>

      {/* 显示设置 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium">显示设置</h2>
        
        {/* 公开状态 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">公开相册</p>
            <p className="text-sm text-text-secondary">在首页广场展示此相册</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('is_public', !formData.is_public)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              formData.is_public ? 'bg-accent' : 'bg-surface-elevated'
            }`}
          >
            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${
              formData.is_public ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 允许下载 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">允许下载原图</p>
            <p className="text-sm text-text-secondary">访客可下载原始高清图片</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('allow_download', !formData.allow_download)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              formData.allow_download ? 'bg-accent' : 'bg-surface-elevated'
            }`}
          >
            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${
              formData.allow_download ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 显示 EXIF */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">显示 EXIF 信息</p>
            <p className="text-sm text-text-secondary">展示相机参数（光圈、快门等）</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('show_exif', !formData.show_exif)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              formData.show_exif ? 'bg-accent' : 'bg-surface-elevated'
            }`}
          >
            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${
              formData.show_exif ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 布局模式 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            默认布局
          </label>
          <select
            value={formData.layout}
            onChange={(e) => handleChange('layout', e.target.value)}
            className="input"
          >
            <option value="masonry">瀑布流 (Masonry)</option>
            <option value="grid">网格 (Grid)</option>
            <option value="carousel">轮播 (Carousel)</option>
          </select>
        </div>

        {/* 排序规则 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            默认排序
          </label>
          <select
            value={formData.sort_rule}
            onChange={(e) => handleChange('sort_rule', e.target.value)}
            className="input"
          >
            <option value="capture_desc">拍摄时间倒序 (最新在前)</option>
            <option value="capture_asc">拍摄时间正序 (最旧在前)</option>
            <option value="manual">手动排序</option>
          </select>
        </div>
      </section>

      {/* 水印配置 */}
      <section className="card space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">水印设置</h2>
          <button
            type="button"
            onClick={() => handleChange('watermark_enabled', !formData.watermark_enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              formData.watermark_enabled ? 'bg-accent' : 'bg-surface-elevated'
            }`}
          >
            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${
              formData.watermark_enabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {formData.watermark_enabled && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                水印类型
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="watermark_type"
                    value="text"
                    checked={formData.watermark_type === 'text'}
                    onChange={(e) => handleChange('watermark_type', e.target.value)}
                    className="radio"
                  />
                  <span>文字水印</span>
                </label>
                {/* 
                // 暂不支持图片水印上传，后续版本迭代
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="watermark_type"
                    value="logo"
                    checked={formData.watermark_type === 'logo'}
                    onChange={(e) => handleChange('watermark_type', e.target.value)}
                    className="radio"
                  />
                  <span>Logo 图片</span>
                </label> 
                */}
              </div>
            </div>

            {formData.watermark_type === 'text' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  水印文字
                </label>
                <input
                  type="text"
                  value={formData.watermark_config.text}
                  onChange={(e) => handleWatermarkConfigChange('text', e.target.value)}
                  className="input"
                  placeholder="© Your Name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                透明度 ({Math.round(formData.watermark_config.opacity * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={formData.watermark_config.opacity}
                onChange={(e) =>
                  handleWatermarkConfigChange('opacity', parseFloat(e.target.value))
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                位置
              </label>
              <select
                value={formData.watermark_config.position}
                onChange={(e) => handleWatermarkConfigChange('position', e.target.value)}
                className="input"
              >
                <option value="center">居中 (Center)</option>
                <option value="southeast">右下 (Bottom Right)</option>
                <option value="southwest">左下 (Bottom Left)</option>
                <option value="northeast">右上 (Top Right)</option>
                <option value="northwest">左上 (Top Left)</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* 提交按钮 */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center gap-2 min-w-[120px] justify-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存设置
        </button>
      </div>
    </form>
  )
}
