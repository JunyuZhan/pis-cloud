'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Eye, EyeOff, Lock, Calendar, Download } from 'lucide-react'
import type { Database } from '@/types/database'
import { MultiWatermarkManager, type WatermarkItem } from './multi-watermark-manager'
import { showSuccess, handleApiError } from '@/lib/toast'

type Album = Database['public']['Tables']['albums']['Row']

interface AlbumSettingsFormProps {
  album: Album
}

export function AlbumSettingsForm({ album }: AlbumSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // 解析水印配置（兼容旧格式和新格式）
  const parseWatermarkConfig = (config: any) => {
    if (!config) {
      return {
        watermarks: [{
          id: 'watermark-1',
          type: 'text' as const,
          text: '© PIS Photography',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }
    }

    // 新格式：包含 watermarks 数组
    if (config.watermarks && Array.isArray(config.watermarks)) {
      return {
        watermarks: config.watermarks.map((w: any, index: number) => ({
          id: w.id || `watermark-${index + 1}`,
          type: w.type || 'text',
          text: w.text,
          logoUrl: w.logoUrl,
          opacity: w.opacity ?? 0.5,
          position: w.position || 'center',
          size: w.size,
          enabled: w.enabled !== false,
        })),
      }
    }

    // 旧格式：单个水印配置
    return {
      watermarks: [{
        id: 'watermark-1',
        type: config.type || 'text',
        text: config.text,
        logoUrl: config.logoUrl,
        opacity: config.opacity ?? 0.5,
        position: config.position || 'center',
        enabled: true,
      }],
    }
  }

  const initialWatermarkConfig = parseWatermarkConfig((album.watermark_config as any))

  const [formData, setFormData] = useState({
    title: album.title,
    description: album.description || '',
    event_date: (album as any).event_date ? new Date((album as any).event_date).toISOString().slice(0, 16) : '',
    location: (album as any).location || '',
    is_public: album.is_public ?? false,
    // 访问控制
    password: (album as any).password || '',
    expires_at: (album as any).expires_at ? new Date((album as any).expires_at).toISOString().slice(0, 16) : '',
    // 布局设置
    layout: album.layout || 'masonry',
    sort_rule: album.sort_rule || 'capture_desc',
    // 功能开关
    allow_download: album.allow_download ?? false,
    allow_batch_download: (album as any).allow_batch_download ?? true,
    show_exif: album.show_exif ?? true,
    // 水印设置
    watermark_enabled: album.watermark_enabled ?? false,
    watermark_config: initialWatermarkConfig,
    // 分享配置
    share_title: (album as any).share_title || '',
    share_description: (album as any).share_description || '',
    share_image_url: (album as any).share_image_url || '',
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

  const handleWatermarksChange = (watermarks: WatermarkItem[]) => {
    setFormData((prev) => ({
      ...prev,
      watermark_config: { watermarks },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 准备提交数据，将 watermarks 数组转换为正确的格式
      const watermarkConfig = formData.watermark_config?.watermarks && formData.watermark_config.watermarks.length > 0
        ? { watermarks: formData.watermark_config.watermarks }
        : {}
      
      const submitData = {
        ...formData,
        event_date: formData.event_date && formData.event_date.trim() ? formData.event_date : null,
        expires_at: formData.expires_at && formData.expires_at.trim() ? formData.expires_at : null,
        location: formData.location.trim() || null,
        watermark_config: watermarkConfig,
      }

      const response = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error?.message || '保存失败'
        console.error('Save failed:', errorData)
        throw new Error(errorMessage)
      }

      const result = await response.json()
      router.refresh()
      showSuccess(result.message || '设置已保存')
    } catch (error) {
      console.error('Save error:', error)
      handleApiError(error, '保存失败，请重试')
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              活动时间
            </label>
            <input
              type="datetime-local"
              value={formData.event_date}
              onChange={(e) => handleChange('event_date', e.target.value)}
              className="input"
            />
            <p className="text-xs text-text-muted mt-1">实际活动日期（可选）</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              活动地点
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="input"
              placeholder="例如：北京国际会议中心"
            />
            <p className="text-xs text-text-muted mt-1">活动举办地点（可选）</p>
          </div>
        </div>
      </section>

      {/* 访问控制 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Lock className="w-5 h-5 text-accent" />
          访问控制
        </h2>
        
        {/* 访问密码 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            访问密码（可选）
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="留空则无需密码"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">设置密码后，访客需要输入密码才能查看相册</p>
        </div>

        {/* 到期时间 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            到期时间（可选）
          </label>
          <input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => handleChange('expires_at', e.target.value)}
            className="input"
          />
          <p className="text-xs text-text-muted mt-1">到期后相册将无法访问，留空则永不过期</p>
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

        {/* 批量下载 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium flex items-center gap-2">
              <Download className="w-4 h-4" />
              允许批量下载
            </p>
            <p className="text-sm text-text-secondary">访客可一键下载所有已选照片</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('allow_batch_download', !formData.allow_batch_download)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              formData.allow_batch_download ? 'bg-accent' : 'bg-surface-elevated'
            }`}
          >
            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${
              formData.allow_batch_download ? 'translate-x-5' : 'translate-x-0'
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
          <div className="pt-4 border-t border-border">
            <MultiWatermarkManager
              watermarks={formData.watermark_config.watermarks || []}
              onChange={handleWatermarksChange}
            />
          </div>
        )}
      </section>

      {/* 分享配置 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium">分享设置</h2>
        <p className="text-sm text-text-muted">
          自定义分享到微信、朋友圈等社交平台时显示的卡片信息
        </p>

        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享标题
            </label>
            <input
              type="text"
              value={formData.share_title}
              onChange={(e) => handleChange('share_title', e.target.value)}
              className="input"
              placeholder={album.title}
            />
            <p className="text-xs text-text-muted mt-1">
              留空则使用相册标题
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享描述
            </label>
            <textarea
              value={formData.share_description}
              onChange={(e) => handleChange('share_description', e.target.value)}
              className="input min-h-[80px] resize-none"
              placeholder={album.description || '查看精彩照片'}
            />
            <p className="text-xs text-text-muted mt-1">
              留空则使用相册描述或默认文案
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享图片 URL
            </label>
            <input
              type="url"
              value={formData.share_image_url}
              onChange={(e) => handleChange('share_image_url', e.target.value)}
              className="input"
              placeholder="https://example.com/share-image.jpg"
            />
            <p className="text-xs text-text-muted mt-1">
              建议尺寸：1200x630px。留空则使用相册封面图
            </p>
          </div>
        </div>
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
