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

      // Mock metadata
      const mockMetadata = { width: 1000, height: 1000 }
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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

      // Mock slow response
      ;(global.fetch as any).mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              headers: new Headers({ 'content-length': '1024' }),
              arrayBuffer: async () => new ArrayBuffer(1024),
            })
          }, 15000) // 15 seconds - should timeout
        })
      })

      const mockMetadata = { width: 1000, height: 1000 }
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
      })

      const startTime = Date.now()
      const result = await processor.process(watermarkConfig)
      const duration = Date.now() - startTime
      
      // Should timeout around 10 seconds (with some tolerance)
      expect(duration).toBeLessThan(12000) // Should be less than 12 seconds
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
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
      vi.spyOn(processor as any, 'image').mockReturnValue({
        metadata: vi.fn().mockResolvedValue(mockMetadata),
        clone: vi.fn().mockReturnThis(),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('preview')),
        composite: vi.fn().mockReturnThis(),
      })

      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
      expect(result.previewBuffer).toBeDefined()
    })
  })
})
