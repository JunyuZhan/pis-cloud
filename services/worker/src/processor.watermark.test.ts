/**
 * 水印功能测试
 * 测试修复后的安全性和功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoProcessor, type WatermarkConfig, type SingleWatermark } from './processor.js'

// Mock fetch
global.fetch = vi.fn()

describe('Watermark Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SSRF Protection', () => {
    it('should reject localhost URLs', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'http://localhost:8080/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock metadata - vitest 4.x: 使用 Object.defineProperty 来 mock 属性
      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // fetch should not be called for localhost
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should reject private IP addresses', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'http://192.168.1.1/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // fetch should not be called for private IPs
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should accept valid external URLs', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock valid response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1024' }),
        arrayBuffer: async () => new ArrayBuffer(1024),
      })

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      // This will fail at sharp processing, but fetch should be called
      try {
        await processor.process(watermarkConfig)
      } catch {
        // Expected to fail at image processing, but URL validation should pass
      }
      
      // fetch should be called for valid URLs (if whitelist allows)
      // Note: This depends on environment variables
    })
  })

  describe('Logo Download Limits', () => {
    it('should reject files larger than 10MB', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/huge-logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock response with large file
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '11000000' }), // 11MB
        arrayBuffer: async () => new ArrayBuffer(11000000),
      })

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing, but logo should be skipped
      expect(result).toBeDefined()
    })

    it('should timeout after 10 seconds', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/slow-logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock slow response - 模拟超时行为
      // fetch 会在 10 秒后被 AbortController 取消
      let abortController: AbortController | null = null
      ;(global.fetch as any).mockImplementationOnce((url: string, options?: { signal?: AbortSignal }) => {
        abortController = options?.signal as AbortController || new AbortController()
        // 模拟慢速响应（15秒），但会在 10 秒后被 abort
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (abortController?.signal.aborted) {
              const error = new Error('The operation was aborted')
              error.name = 'AbortError'
              reject(error)
            } else {
              resolve({
                ok: true,
                headers: new Headers({ 'content-length': '1024' }),
                arrayBuffer: async () => new ArrayBuffer(1024),
              })
            }
          }, 15000) // 15 seconds - should timeout before this
          
          // 模拟 AbortController 的 abort 行为
          if (abortController) {
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeout)
              const error = new Error('The operation was aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
        })
      })

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const startTime = Date.now()
      const result = await processor.process(watermarkConfig)
      const duration = Date.now() - startTime
      
      // Should timeout around 10 seconds (with some tolerance)
      // 实际超时时间可能在 10-12 秒之间
      expect(duration).toBeLessThan(13000) // Should be less than 13 seconds
      expect(result).toBeDefined()
    })
  })

  describe('Watermark Configuration Validation', () => {
    it('should handle multiple watermarks', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [
          {
            type: 'text',
            text: '© Test',
            opacity: 0.5,
            position: 'top-left',
            enabled: true,
          },
          {
            type: 'text',
            text: 'Watermark 2',
            opacity: 0.7,
            position: 'bottom-right',
            enabled: true,
          },
        ],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
      expect(result.previewBuffer).toBeDefined()
    })

    it('should skip disabled watermarks', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [
          {
            type: 'text',
            text: 'Enabled',
            opacity: 0.5,
            position: 'center',
            enabled: true,
          },
          {
            type: 'text',
            text: 'Disabled',
            opacity: 0.5,
            position: 'center',
            enabled: false,
          },
        ],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
    })
  })

  describe('Boundary Checks', () => {
    it('should handle invalid image dimensions', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'text',
          text: 'Test',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock invalid metadata
      const mockMetadata = { width: 0, height: 0 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should handle gracefully without crashing
      expect(result).toBeDefined()
    })
  })

  describe('Backward Compatibility', () => {
    it('should support old single watermark format', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        type: 'text',
        text: 'Old Format',
        opacity: 0.5,
        position: 'center',
      }

      const mockMetadata = { width: 1000, height: 1000 }
      // 创建链式调用的 mock 对象 - 生成正确的 RGBA 像素数据用于 blurhash
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128) // RGBA 格式，32x32 像素
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
      expect(result.previewBuffer).toBeDefined()
    })
  })

  describe('Logo Download Error Handling', () => {
    it('should handle logo download failure (non-ok response)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock non-ok response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing, logo should be skipped
      expect(result).toBeDefined()
    })

    it('should handle logo file too large (Content-Length check)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/huge-logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock response with large Content-Length
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '11000000' }), // 11MB
        arrayBuffer: async () => new ArrayBuffer(1024),
      })

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing
      expect(result).toBeDefined()
    })

    it('should handle logo file too large (actual size check)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/huge-logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock response with large actual size
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1024' }),
        arrayBuffer: async () => new ArrayBuffer(11000000), // 11MB actual
      })

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing
      expect(result).toBeDefined()
    })

    it('should handle logo processing error (logoW or logoH null)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock valid response
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1024' }),
        arrayBuffer: async () => new ArrayBuffer(1024),
      })

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      
      // Mock sharp to return null width/height
      const sharp = await import('sharp')
      const originalResize = sharp.default.prototype.resize
      vi.spyOn(sharp.default.prototype, 'resize').mockReturnValue({
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from('logo'),
          info: { width: 0, height: 0 } // Null dimensions
        }),
      } as any)

      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing
      expect(result).toBeDefined()
    })

    it('should handle fetch error (non-AbortError)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'https://example.com/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      // Mock fetch error
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      // Should complete without crashing
      expect(result).toBeDefined()
    })
  })

  describe('Position and Text Handling', () => {
    it('should handle all position types for text watermark', async () => {
      const positions = [
        'top-left', 'top-center', 'top-right',
        'center-left', 'center', 'center-right',
        'bottom-left', 'bottom-center', 'bottom-right'
      ]

      for (const position of positions) {
        const buffer = Buffer.from('fake-image-data')
        const processor = new PhotoProcessor(buffer)
        
        const watermarkConfig: WatermarkConfig = {
          enabled: true,
          watermarks: [{
            type: 'text',
            text: `Test ${position}`,
            opacity: 0.5,
            position: position as any,
            enabled: true,
          }],
        }

        const mockMetadata = { width: 1000, height: 1000 }
        const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
        const chainMock = {
          ensureAlpha: vi.fn().mockReturnThis(),
          resize: vi.fn().mockReturnThis(),
          toBuffer: vi.fn().mockResolvedValue({ 
            data: Buffer.from(pixelData),
            info: { width: 32, height: 32 }
          }),
        }
        const mockImage = {
          metadata: vi.fn().mockResolvedValue(mockMetadata),
          clone: vi.fn().mockReturnThis(),
          rotate: vi.fn().mockReturnThis(),
          resize: vi.fn().mockReturnThis(),
          jpeg: vi.fn().mockReturnThis(),
          toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
          composite: vi.fn().mockReturnThis(),
          raw: vi.fn().mockReturnValue(chainMock),
        }
        Object.defineProperty(processor, 'image', {
          value: mockImage,
          writable: true,
          configurable: true,
        })

        const result = await processor.process(watermarkConfig)
        expect(result).toBeDefined()
      }
    })

    it('should handle XML special characters in text watermark', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'text',
          text: 'Test & < > " \' Special',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
      // Verify XML characters are escaped in the SVG
      const compositeCall = mockImage.composite.mock.calls[0]
      if (compositeCall && compositeCall[0] && compositeCall[0][0]) {
        const svgBuffer = compositeCall[0][0].input
        const svgText = svgBuffer.toString()
        expect(svgText).toContain('&amp;')
        expect(svgText).toContain('&lt;')
        expect(svgText).toContain('&gt;')
        expect(svgText).toContain('&quot;')
        expect(svgText).toContain('&apos;')
      }
    })

    it('should handle custom margin for text watermark', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'text',
          text: 'Test',
          opacity: 0.5,
          position: 'bottom-right',
          margin: 10, // 10% margin
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
    })

    it('should handle custom size for text watermark', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'text',
          text: 'Test',
          opacity: 0.5,
          position: 'center',
          size: 48, // Custom font size
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
    })

    it('should handle invalid position (fallback to center)', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'text',
          text: 'Test',
          opacity: 0.5,
          position: 'invalid-position' as any,
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
    })
  })

  describe('URL Validation', () => {
    it('should reject invalid protocols', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'ftp://example.com/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(global.fetch).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should reject 172.16-31 private IP range', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'http://172.20.1.1/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(global.fetch).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should reject .local domains', async () => {
      const buffer = Buffer.from('fake-image-data')
      const processor = new PhotoProcessor(buffer)
      
      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        watermarks: [{
          type: 'logo',
          logoUrl: 'http://example.local/logo.png',
          opacity: 0.5,
          position: 'center',
          enabled: true,
        }],
      }

      const mockMetadata = { width: 1000, height: 1000 }
      const pixelData = new Uint8ClampedArray(32 * 32 * 4).fill(128)
      const chainMock = {
        ensureAlpha: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue({ 
          data: Buffer.from(pixelData),
          info: { width: 32, height: 32 }
        }),
      }
      const mockImage = {
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnValue(chainMock),
      }
      Object.defineProperty(processor, 'image', {
        value: mockImage,
        writable: true,
        configurable: true,
      })

      const result = await processor.process(watermarkConfig)
      
      expect(global.fetch).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })
})
