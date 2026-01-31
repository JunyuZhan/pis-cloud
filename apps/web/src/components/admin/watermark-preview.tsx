'use client'

import { useEffect, useRef, useState } from 'react'
import type { WatermarkItem } from './multi-watermark-manager'

interface WatermarkPreviewProps {
  watermarks: WatermarkItem[]
  width?: number
  height?: number
}

export function WatermarkPreview({ watermarks, width = 400, height = 300 }: WatermarkPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [logoImages, setLogoImages] = useState<Map<string, HTMLImageElement>>(new Map())

  // 计算文字水印位置
  function getPosition(
    position: string,
    imgWidth: number,
    imgHeight: number,
    customMargin?: number
  ): { x: number; y: number; textAlign: string; textBaseline: string } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05
    const margin = Math.min(imgWidth, imgHeight) * marginPercent

    const positions: Record<string, { x: number; y: number; textAlign: string; textBaseline: string }> = {
      'top-left': { x: margin, y: margin, textAlign: 'left', textBaseline: 'top' },
      'top-center': { x: imgWidth / 2, y: margin, textAlign: 'center', textBaseline: 'top' },
      'top-right': { x: imgWidth - margin, y: margin, textAlign: 'right', textBaseline: 'top' },
      'center-left': { x: margin, y: imgHeight / 2, textAlign: 'left', textBaseline: 'middle' },
      'center': { x: imgWidth / 2, y: imgHeight / 2, textAlign: 'center', textBaseline: 'middle' },
      'center-right': { x: imgWidth - margin, y: imgHeight / 2, textAlign: 'right', textBaseline: 'middle' },
      'bottom-left': { x: margin, y: imgHeight - margin, textAlign: 'left', textBaseline: 'bottom' },
      'bottom-center': { x: imgWidth / 2, y: imgHeight - margin, textAlign: 'center', textBaseline: 'bottom' },
      'bottom-right': { x: imgWidth - margin, y: imgHeight - margin, textAlign: 'right', textBaseline: 'bottom' },
    }

    return positions[position] || positions['center']
  }

  // 计算 Logo 水印位置（考虑 Logo 尺寸，与后端逻辑一致）
  function getLogoPosition(
    position: string,
    imgWidth: number,
    imgHeight: number,
    logoWidth: number,
    logoHeight: number,
    customMargin?: number
  ): { x: number; y: number } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05
    const margin = Math.min(imgWidth, imgHeight) * marginPercent
    
    // 确保 logo 不会超出图片边界
    const maxX = Math.max(0, imgWidth - logoWidth)
    const maxY = Math.max(0, imgHeight - logoHeight)

    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: Math.min(margin, maxX), y: Math.min(margin, maxY) },
      'top-center': { x: Math.max(0, Math.min((imgWidth - logoWidth) / 2, maxX)), y: Math.min(margin, maxY) },
      'top-right': { x: Math.max(0, Math.min(imgWidth - logoWidth - margin, maxX)), y: Math.min(margin, maxY) },
      'center-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min((imgHeight - logoHeight) / 2, maxY)) },
      'center': { x: Math.max(0, Math.min((imgWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min((imgHeight - logoHeight) / 2, maxY)) },
      'center-right': { x: Math.max(0, Math.min(imgWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min((imgHeight - logoHeight) / 2, maxY)) },
      'bottom-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min(imgHeight - logoHeight - margin, maxY)) },
      'bottom-center': { x: Math.max(0, Math.min((imgWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min(imgHeight - logoHeight - margin, maxY)) },
      'bottom-right': { x: Math.max(0, Math.min(imgWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min(imgHeight - logoHeight - margin, maxY)) },
    }

    const pos = positions[position] || positions['center']
    
    // 最终边界检查，确保坐标在有效范围内
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    }
  }

  // 加载 Logo 图片
  useEffect(() => {
    const loadLogos = async () => {
      const newLogoImages = new Map<string, HTMLImageElement>()
      
      for (const watermark of watermarks) {
        if (watermark.type === 'logo' && watermark.logoUrl && watermark.enabled !== false) {
          try {
            const img = new Image()
            // 尝试设置跨域，但如果服务器不支持 CORS 则可能失败
            img.crossOrigin = 'anonymous'
            
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Timeout'))
              }, 5000) // 5秒超时
              
              img.onload = () => {
                clearTimeout(timeout)
                resolve(img)
              }
              img.onerror = (error) => {
                clearTimeout(timeout)
                reject(error)
              }
              img.src = watermark.logoUrl!
            })
            
            newLogoImages.set(watermark.id, img)
          } catch (error) {
            console.warn(`Failed to load logo for watermark ${watermark.id}:`, error)
            // 不设置图片，后续会显示占位符
          }
        }
      }
      
      setLogoImages(newLogoImages)
    }

    loadLogos()
  }, [watermarks])

  // 绘制预览
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布尺寸
    canvas.width = width
    canvas.height = height

    // 清空画布
    ctx.clearRect(0, 0, width, height)

    // 绘制背景（模拟照片）
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(0.5, '#16213e')
    gradient.addColorStop(1, '#0f3460')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // 添加一些纹理效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() * 30 + 10
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制网格线（可选，帮助定位）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const x = (width / 3) * i
      const y = (height / 3) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // 绘制每个启用的水印
    watermarks.forEach((watermark) => {
      if (watermark.enabled === false) return

      const position = getPosition(watermark.position, width, height, watermark.margin)
      
      if (watermark.type === 'text' && watermark.text) {
        // 绘制文字水印
        const fontSize = watermark.size || Math.max(12, Math.min(48, Math.floor(Math.sqrt(width * height) * 0.015)))
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.fillStyle = `rgba(255, 255, 255, ${watermark.opacity || 0.5})`
        ctx.textAlign = position.textAlign as CanvasTextAlign
        ctx.textBaseline = position.textBaseline as CanvasTextBaseline
        ctx.fillText(watermark.text, position.x, position.y)
        
        // 绘制位置标记（小圆圈）
        ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
        ctx.beginPath()
        ctx.arc(position.x, position.y, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (watermark.type === 'logo' && watermark.logoUrl) {
        // 绘制 Logo 水印
        const logoImg = logoImages.get(watermark.id)
        const logoSize = watermark.size || Math.floor(Math.min(width, height) * 0.15)
        
        if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
          // Logo 已成功加载
          const logoAspect = logoImg.width / logoImg.height
          let logoW = logoSize
          let logoH = logoSize / logoAspect
          
          if (logoH > logoSize) {
            logoH = logoSize
            logoW = logoSize * logoAspect
          }

          // 计算实际位置（考虑 Logo 尺寸）
          const actualPosition = getLogoPosition(watermark.position, width, height, logoW, logoH, watermark.margin)

          // 应用透明度
          ctx.globalAlpha = watermark.opacity || 0.5
          ctx.drawImage(logoImg, actualPosition.x, actualPosition.y, logoW, logoH)
          ctx.globalAlpha = 1.0

          // 绘制位置标记（小圆圈）
          ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
          ctx.beginPath()
          ctx.arc(actualPosition.x + logoW / 2, actualPosition.y + logoH / 2, 4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Logo 未加载，显示占位符
          const actualPosition = getLogoPosition(watermark.position, width, height, logoSize, logoSize, watermark.margin)
          
          ctx.fillStyle = `rgba(255, 255, 255, ${watermark.opacity || 0.5})`
          ctx.fillRect(actualPosition.x, actualPosition.y, logoSize, logoSize)
          
          // 绘制边框
          ctx.strokeStyle = `rgba(255, 255, 255, ${(watermark.opacity || 0.5) * 0.5})`
          ctx.lineWidth = 1
          ctx.strokeRect(actualPosition.x, actualPosition.y, logoSize, logoSize)
          
          // 绘制占位符文字
          ctx.fillStyle = `rgba(0, 0, 0, ${watermark.opacity || 0.5})`
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('Logo', actualPosition.x + logoSize / 2, actualPosition.y + logoSize / 2)
          
          // 绘制位置标记
          ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
          ctx.beginPath()
          ctx.arc(actualPosition.x + logoSize / 2, actualPosition.y + logoSize / 2, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watermarks, logoImages, width, height])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto border border-border rounded-lg shadow-sm bg-surface"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {watermarks.filter(w => w.enabled !== false).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/50 rounded-lg">
          <p className="text-sm text-text-muted">暂无启用的水印</p>
        </div>
      )}
    </div>
  )
}
