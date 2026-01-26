/**
 * 动态海报生成器
 * 使用 Canvas API 合成包含背景图、标题、描述、二维码的海报
 */

export interface PosterStyle {
  // 布局选项
  layout?: 'centered' | 'top' | 'bottom'
  // 颜色选项
  titleColor?: string
  descriptionColor?: string
  // 字体大小
  titleFontSize?: number
  descriptionFontSize?: number
  // 遮罩透明度
  overlayOpacity?: number
  // 二维码位置
  qrPosition?: 'bottom-center' | 'bottom-right' | 'bottom-left'
  // 二维码大小
  qrSize?: number
}

/**
 * 预设海报样式模板
 * 提供经过设计的样式组合，确保海报质量
 */
export const POSTER_PRESETS: Record<string, PosterStyle> = {
  // 经典风格：居中布局，白色文字，适中遮罩
  classic: {
    layout: 'centered',
    titleColor: '#FFFFFF',
    descriptionColor: '#FFFFFF',
    titleFontSize: 52,
    descriptionFontSize: 28,
    overlayOpacity: 0.45,
    qrPosition: 'bottom-center',
    qrSize: 280,
  },
  // 简约风格：顶部布局，高对比度
  minimal: {
    layout: 'top',
    titleColor: '#FFFFFF',
    descriptionColor: '#F5F5F5',
    titleFontSize: 48,
    descriptionFontSize: 24,
    overlayOpacity: 0.5,
    qrPosition: 'bottom-right',
    qrSize: 240,
  },
  // 优雅风格：底部布局，柔和色调
  elegant: {
    layout: 'bottom',
    titleColor: '#FFFFFF',
    descriptionColor: '#E8E8E8',
    titleFontSize: 56,
    descriptionFontSize: 30,
    overlayOpacity: 0.4,
    qrPosition: 'bottom-center',
    qrSize: 300,
  },
  // 商务风格：居中布局，专业配色
  business: {
    layout: 'centered',
    titleColor: '#FFFFFF',
    descriptionColor: '#F0F0F0',
    titleFontSize: 50,
    descriptionFontSize: 26,
    overlayOpacity: 0.5,
    qrPosition: 'bottom-center',
    qrSize: 280,
  },
}

/**
 * 验证并限制样式参数，确保海报质量
 */
export function validateAndLimitStyle(style: PosterStyle): PosterStyle {
  const validated: PosterStyle = { ...style }

  // 限制字体大小范围（确保可读性）
  if (validated.titleFontSize !== undefined) {
    validated.titleFontSize = Math.max(32, Math.min(72, validated.titleFontSize))
  }
  if (validated.descriptionFontSize !== undefined) {
    validated.descriptionFontSize = Math.max(18, Math.min(40, validated.descriptionFontSize))
  }

  // 限制遮罩透明度（确保文字可读性）
  if (validated.overlayOpacity !== undefined) {
    validated.overlayOpacity = Math.max(0.2, Math.min(0.8, validated.overlayOpacity))
  }

  // 限制二维码大小（确保扫描性）
  if (validated.qrSize !== undefined) {
    validated.qrSize = Math.max(200, Math.min(400, validated.qrSize))
  }

  // 验证颜色格式（必须是有效的十六进制颜色）
  if (validated.titleColor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(validated.titleColor)) {
      validated.titleColor = '#FFFFFF' // 默认白色
    }
  }
  if (validated.descriptionColor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(validated.descriptionColor)) {
      validated.descriptionColor = '#FFFFFF' // 默认白色
    }
  }

  return validated
}

export interface PosterOptions {
  backgroundImageUrl: string | null
  title: string
  description?: string | null
  qrCodeUrl: string
  width?: number
  height?: number
  style?: PosterStyle
}

interface PosterResult {
  dataUrl: string
  blob: Blob
}

/**
 * 加载图片并返回 Image 对象
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

/**
 * 加载二维码 SVG 并转换为 Image
 */
function loadQRCodeSVG(svgElement: SVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load QR code SVG'))
      }
      img.src = url
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 绘制文字（支持自动换行）
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  lineHeight: number = 1.2
): number {
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  
  // 按字符分割（中文按字符，英文按单词）
  const chars = text.split('')
  let line = ''
  let currentY = y
  
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    
    if (testWidth > maxWidth && line.length > 0) {
      ctx.fillText(line, x, currentY)
      line = chars[i]
      currentY += fontSize * lineHeight
    } else {
      line = testLine
    }
  }
  
  if (line) {
    ctx.fillText(line, x, currentY)
    currentY += fontSize * lineHeight
  }
  
  return currentY
}

/**
 * 生成动态海报
 */
export async function generatePoster(options: PosterOptions): Promise<PosterResult> {
  const {
    backgroundImageUrl,
    title,
    description,
    width = 750,
    height = 1334,
    style = {},
  } = options

  // 验证并限制样式参数，确保海报质量
  const validatedStyle = validateAndLimitStyle(style)

  // 提取样式选项，使用默认值
  const {
    layout = 'centered',
    titleColor = '#FFFFFF',
    descriptionColor = '#FFFFFF',
    titleFontSize = 48,
    descriptionFontSize = 28,
    overlayOpacity = 0.4,
    qrPosition = 'bottom-center',
    qrSize = 280,
  } = validatedStyle

  // 创建 Canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  // 1. 绘制背景
  if (backgroundImageUrl) {
    try {
      const bgImage = await loadImage(backgroundImageUrl)
      // 计算缩放比例，确保图片覆盖整个画布
      const scale = Math.max(width / bgImage.width, height / bgImage.height)
      const scaledWidth = bgImage.width * scale
      const scaledHeight = bgImage.height * scale
      const x = (width - scaledWidth) / 2
      const y = (height - scaledHeight) / 2
      
      ctx.drawImage(bgImage, x, y, scaledWidth, scaledHeight)
      
      // 添加半透明遮罩，提高文字可读性（可配置透明度）
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`
      ctx.fillRect(0, 0, width, height)
    } catch (error) {
      console.warn('Failed to load background image, using gradient:', error)
      // 如果背景图加载失败，使用渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#667eea')
      gradient.addColorStop(1, '#764ba2')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  } else {
    // 没有背景图，使用渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  // 2. 根据布局计算标题和描述位置
  let titleY: number
  let descriptionY: number
  
  if (layout === 'top') {
    titleY = height * 0.1
  } else if (layout === 'bottom') {
    titleY = height * 0.5
  } else {
    // centered (默认)
    titleY = height * 0.2
  }
  
  const titleMaxWidth = width * 0.85
  const titleEndY = drawText(ctx, title, width / 2, titleY, titleMaxWidth, titleFontSize, titleColor)

  // 3. 绘制描述（如果有）
  descriptionY = titleEndY + 20
  if (description && description.trim()) {
    ctx.font = `${descriptionFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
    ctx.fillStyle = descriptionColor
    ctx.textAlign = 'center'
    
    const descMaxWidth = width * 0.8
    const lines = description.split('\n')
    lines.forEach((line, index) => {
      if (line.trim()) {
        drawText(ctx, line.trim(), width / 2, descriptionY + index * descriptionFontSize * 1.5, descMaxWidth, descriptionFontSize, descriptionColor)
      }
    })
    descriptionY += lines.length * descriptionFontSize * 1.5
  }

  // 4. 绘制二维码（根据位置选项）
  try {
    // 从 DOM 中获取二维码 SVG 元素
    const qrSvgElement = document.getElementById('qr-code-svg')
    if (qrSvgElement && qrSvgElement instanceof SVGElement) {
      const qrSvg = qrSvgElement
      const qrImage = await loadQRCodeSVG(qrSvg)
      const actualQrSize = Math.min(width * 0.4, qrSize)
      
      // 根据位置计算二维码坐标
      let qrX: number
      let qrY: number
      
      if (qrPosition === 'bottom-right') {
        qrX = width - actualQrSize - 40
        qrY = height - actualQrSize - 120
      } else if (qrPosition === 'bottom-left') {
        qrX = 40
        qrY = height - actualQrSize - 120
      } else {
        // bottom-center (默认)
        qrX = (width - actualQrSize) / 2
        qrY = height - actualQrSize - 120
      }
      
      // 绘制白色背景
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(qrX - 10, qrY - 10, actualQrSize + 20, actualQrSize + 20)
      
      // 绘制二维码
      ctx.drawImage(qrImage, qrX, qrY, actualQrSize, actualQrSize)
      
      // 绘制提示文字（只在居中时显示）
      if (qrPosition === 'bottom-center') {
        ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.fillText('扫描二维码查看相册', width / 2, qrY + actualQrSize + 40)
      }
    } else {
      // 如果没有 SVG，尝试从 URL 生成二维码
      console.warn('QR code SVG not found, skipping QR code in poster')
    }
  } catch (error) {
    console.warn('Failed to add QR code to poster:', error)
  }

  // 5. 转换为 Blob 和 Data URL
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate poster blob'))
          return
        }
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          blob,
        })
      },
      'image/png',
      0.95
    )
  })
}

/**
 * 下载海报
 */
export function downloadPoster(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
