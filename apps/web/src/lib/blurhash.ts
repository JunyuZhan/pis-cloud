/**
 * BlurHash 工具函数
 * 将 BlurHash 字符串转换为 data URL，用于 Next.js Image 组件的 placeholder
 * 
 * 注意：Next.js Image 的 placeholder="blur" 需要在服务端生成 blurDataURL
 * 但由于 blurhash 解码需要 DOM API，我们使用客户端生成的方式
 */

/**
 * 将 BlurHash 字符串转换为 data URL（仅在客户端）
 * @param blurHash BlurHash 字符串
 * @param width 输出图片宽度（默认 32）
 * @param height 输出图片高度（默认 32）
 * @returns data URL 字符串，如果不在客户端则返回 undefined
 */
export function getBlurDataURL(
  blurHash: string | null | undefined,
  width: number = 32,
  height: number = 32
): string | undefined {
  // 只在客户端执行
  if (typeof window === 'undefined' || !blurHash) {
    return undefined
  }

  try {
    // 动态导入 blurhash，避免服务端打包问题
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decode } = require('blurhash')
    const pixels = decode(blurHash, width, height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return undefined
    }
    
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
    
    return canvas.toDataURL()
  } catch (error) {
    console.warn('Failed to decode BlurHash:', error)
    return undefined
  }
}
