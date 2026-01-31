/**
 * Dynamic Poster Generator
 * Uses Canvas API to composite posters with background image, title, description, and QR code
 */

export interface PosterStyle {
  // Layout options
  layout?: 'centered' | 'top' | 'bottom'
  // Color options
  titleColor?: string
  descriptionColor?: string
  // Font sizes
  titleFontSize?: number
  descriptionFontSize?: number
  // Overlay opacity
  overlayOpacity?: number
  // QR code position
  qrPosition?: 'bottom-center' | 'bottom-right' | 'bottom-left'
  // QR code size
  qrSize?: number
}

/**
 * Preset poster style templates
 * Provides designed style combinations to ensure poster quality
 */
export const POSTER_PRESETS: Record<string, PosterStyle> = {
  // Classic style: centered layout, white text, moderate overlay
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
  // Minimal style: top layout, high contrast
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
  // Elegant style: bottom layout, soft tones
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
  // Business style: centered layout, professional color scheme
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
 * Validate and limit style parameters to ensure poster quality
 */
export function validateAndLimitStyle(style: PosterStyle): PosterStyle {
  const validated: PosterStyle = { ...style }

  // Limit font size range (ensure readability)
  if (validated.titleFontSize !== undefined) {
    validated.titleFontSize = Math.max(32, Math.min(72, validated.titleFontSize))
  }
  if (validated.descriptionFontSize !== undefined) {
    validated.descriptionFontSize = Math.max(18, Math.min(40, validated.descriptionFontSize))
  }

  // Limit overlay opacity (ensure text readability)
  if (validated.overlayOpacity !== undefined) {
    validated.overlayOpacity = Math.max(0.2, Math.min(0.8, validated.overlayOpacity))
  }

  // Limit QR code size (ensure scannability)
  if (validated.qrSize !== undefined) {
    validated.qrSize = Math.max(200, Math.min(400, validated.qrSize))
  }

  // Validate color format (must be valid hex color)
  if (validated.titleColor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(validated.titleColor)) {
      validated.titleColor = '#FFFFFF' // Default white
    }
  }
  if (validated.descriptionColor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(validated.descriptionColor)) {
      validated.descriptionColor = '#FFFFFF' // Default white
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
 * Load image and return Image object
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
 * Load QR code SVG and convert to Image
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
 * Draw text with automatic line wrapping support
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
  
  // Split by characters (Chinese by character, English by word)
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
 * Generate dynamic poster
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

  // Validate and limit style parameters to ensure poster quality
  const validatedStyle = validateAndLimitStyle(style)

  // Extract style options with default values
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

  // Create Canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  // 1. Draw background
  if (backgroundImageUrl) {
    try {
      const bgImage = await loadImage(backgroundImageUrl)
      // Calculate scale to ensure image covers entire canvas
      const scale = Math.max(width / bgImage.width, height / bgImage.height)
      const scaledWidth = bgImage.width * scale
      const scaledHeight = bgImage.height * scale
      const x = (width - scaledWidth) / 2
      const y = (height - scaledHeight) / 2
      
      ctx.drawImage(bgImage, x, y, scaledWidth, scaledHeight)
      
      // Add semi-transparent overlay to improve text readability (configurable opacity)
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`
      ctx.fillRect(0, 0, width, height)
    } catch (error) {
      console.warn('Failed to load background image, using gradient:', error)
      // If background image fails to load, use gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#667eea')
      gradient.addColorStop(1, '#764ba2')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  } else {
    // No background image, use gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  // 2. Calculate title and description positions based on layout
  let titleY: number
  let descriptionY: number
  
  if (layout === 'top') {
    titleY = height * 0.1
  } else if (layout === 'bottom') {
    titleY = height * 0.5
  } else {
    // centered (default)
    titleY = height * 0.2
  }
  
  const titleMaxWidth = width * 0.85
  const titleEndY = drawText(ctx, title, width / 2, titleY, titleMaxWidth, titleFontSize, titleColor)

  // 3. Draw description (if provided)
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

  // 4. Draw QR code (based on position option)
  try {
    // Get QR code SVG element from DOM
    const qrSvgElement = document.getElementById('qr-code-svg')
    if (qrSvgElement && qrSvgElement instanceof SVGElement) {
      const qrSvg = qrSvgElement
      const qrImage = await loadQRCodeSVG(qrSvg)
      const actualQrSize = Math.min(width * 0.4, qrSize)
      
      // Calculate QR code coordinates based on position
      let qrX: number
      let qrY: number
      
      if (qrPosition === 'bottom-right') {
        qrX = width - actualQrSize - 40
        qrY = height - actualQrSize - 120
      } else if (qrPosition === 'bottom-left') {
        qrX = 40
        qrY = height - actualQrSize - 120
      } else {
        // bottom-center (default)
        qrX = (width - actualQrSize) / 2
        qrY = height - actualQrSize - 120
      }
      
      // Draw white background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(qrX - 10, qrY - 10, actualQrSize + 20, actualQrSize + 20)
      
      // Draw QR code
      ctx.drawImage(qrImage, qrX, qrY, actualQrSize, actualQrSize)
      
      // Draw hint text (only shown when centered)
      if (qrPosition === 'bottom-center') {
        ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.fillText('Scan QR code to view album', width / 2, qrY + actualQrSize + 40)
      }
    } else {
      // If no SVG, try to generate QR code from URL
      console.warn('QR code SVG not found, skipping QR code in poster')
    }
  } catch (error) {
    console.warn('Failed to add QR code to poster:', error)
  }

  // 5. Convert to Blob and Data URL
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
 * Download poster
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
