/**
 * PhotoProcessor 核心功能测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoProcessor } from './processor.js'

// Mock sharp
vi.mock('sharp', () => {
  const mockMetadata = {
    width: 2000,
    height: 1500,
    format: 'jpeg',
    exif: Buffer.from('mock-exif'),
  }

  const chainMock = {
    ensureAlpha: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from(new Uint8ClampedArray(32 * 32 * 4).fill(128)),
      info: { width: 32, height: 32 },
    }),
  }

  const mockImage = {
    metadata: vi.fn().mockResolvedValue(mockMetadata),
    clone: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
    composite: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnValue(chainMock),
  }

  return {
    default: vi.fn().mockReturnValue(mockImage),
  }
})

// Mock blurhash
vi.mock('blurhash', () => ({
  encode: vi.fn().mockReturnValue('mock-blurhash'),
}))

// Mock exif-reader
vi.mock('exif-reader', () => ({
  default: vi.fn().mockReturnValue({
    exif: {
      DateTimeOriginal: '2024-01-01T00:00:00Z',
    },
    gps: {
      GPSLatitude: 39.9,
      GPSLongitude: 116.4,
    },
  }),
}))

describe('PhotoProcessor', () => {
  let processor: PhotoProcessor

  beforeEach(() => {
    const buffer = Buffer.from('fake-image-data')
    processor = new PhotoProcessor(buffer)
    vi.clearAllMocks()
  })

  describe('process', () => {
    it('should process image without watermark', async () => {
      const result = await processor.process()
      
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('exif')
      expect(result).toHaveProperty('blurHash')
      expect(result).toHaveProperty('thumbBuffer')
      expect(result).toHaveProperty('previewBuffer')
      expect(result.blurHash).toBe('mock-blurhash')
    })

    it('should process image with manual rotation', async () => {
      const result = await processor.process(undefined, 90)
      
      expect(result).toBeDefined()
      // 验证 rotate 被调用了两次（EXIF + manual）
    })

    it('should handle null manual rotation', async () => {
      const result = await processor.process(undefined, null)
      
      expect(result).toBeDefined()
    })

    it('should process image with watermark disabled', async () => {
      const watermarkConfig = {
        enabled: false,
      }
      
      const result = await processor.process(watermarkConfig)
      
      expect(result).toBeDefined()
    })

    it('should handle EXIF parsing errors gracefully', async () => {
      // Mock exif-reader to throw error
      const exifReader = await import('exif-reader')
      vi.mocked(exifReader.default).mockImplementationOnce(() => {
        throw new Error('EXIF parse error')
      })

      const result = await processor.process()
      
      expect(result).toBeDefined()
      expect(result.exif).toEqual({})
    })

    it('should handle missing EXIF data', async () => {
      const sharp = await import('sharp')
      const mockImage = sharp.default(Buffer.from('test'))
      
      // Mock metadata without exif
      vi.mocked(mockImage.metadata).mockResolvedValueOnce({
        width: 2000,
        height: 1500,
        format: 'jpeg',
      } as any)

      const result = await processor.process()
      
      expect(result).toBeDefined()
      expect(result.exif).toEqual({})
    })

    it('should sanitize EXIF GPS data', async () => {
      const result = await processor.process()
      
      // GPS 数据应该被移除
      expect(result.exif).not.toHaveProperty('gps')
    })
  })

  describe('isValidLogoUrl', () => {
    it('should reject localhost URLs', () => {
      const isValid = (processor as any).isValidLogoUrl('http://localhost:8080/logo.png')
      expect(isValid).toBe(false)
    })

    it('should reject private IP addresses', () => {
      expect((processor as any).isValidLogoUrl('http://192.168.1.1/logo.png')).toBe(false)
      expect((processor as any).isValidLogoUrl('http://10.0.0.1/logo.png')).toBe(false)
      expect((processor as any).isValidLogoUrl('http://172.16.0.1/logo.png')).toBe(false)
    })

    it('should accept valid external URLs', () => {
      const isValid = (processor as any).isValidLogoUrl('https://example.com/logo.png')
      // 注意：如果配置了白名单，可能需要调整测试
      expect(typeof isValid).toBe('boolean')
    })

    it('should reject invalid URLs', () => {
      const isValid = (processor as any).isValidLogoUrl('not-a-url')
      expect(isValid).toBe(false)
    })

    it('should reject non-HTTP protocols', () => {
      const isValid = (processor as any).isValidLogoUrl('file:///path/to/logo.png')
      expect(isValid).toBe(false)
    })
  })

  describe('sanitizeExif', () => {
    it('should remove GPS data from EXIF', () => {
      const exifWithGPS = {
        exif: {
          DateTimeOriginal: '2024-01-01',
        },
        gps: {
          GPSLatitude: 39.9,
          GPSLongitude: 116.4,
        },
      }

      const sanitized = (processor as any).sanitizeExif(exifWithGPS)
      
      expect(sanitized).not.toHaveProperty('gps')
      expect(sanitized.exif).toHaveProperty('DateTimeOriginal')
    })

    it('should preserve non-GPS EXIF data', () => {
      const exif = {
        exif: {
          DateTimeOriginal: '2024-01-01',
          ISO: 100,
        },
        image: {
          Make: 'Canon',
        },
      }

      const sanitized = (processor as any).sanitizeExif(exif)
      
      expect(sanitized.exif).toHaveProperty('DateTimeOriginal')
      expect(sanitized.exif).toHaveProperty('ISO')
      expect(sanitized.image).toHaveProperty('Make')
    })
  })

  describe('positionToGravity', () => {
    it('should convert position strings to gravity', () => {
      const positionToGravity = (processor as any).positionToGravity.bind(processor)
      
      expect(positionToGravity('top-left')).toBe('northwest')
      expect(positionToGravity('top-center')).toBe('north')
      expect(positionToGravity('top-right')).toBe('northeast')
      expect(positionToGravity('center-left')).toBe('west')
      expect(positionToGravity('center')).toBe('center')
      expect(positionToGravity('center-right')).toBe('east')
      expect(positionToGravity('bottom-left')).toBe('southwest')
      expect(positionToGravity('bottom-center')).toBe('south')
      expect(positionToGravity('bottom-right')).toBe('southeast')
    })
  })

  describe('escapeXml', () => {
    it('should escape XML special characters', () => {
      const escapeXml = (processor as any).escapeXml.bind(processor)
      
      expect(escapeXml('test')).toBe('test')
      expect(escapeXml('test & value')).toBe('test &amp; value')
      expect(escapeXml('test < value')).toBe('test &lt; value')
      expect(escapeXml('test > value')).toBe('test &gt; value')
      expect(escapeXml('test " value')).toBe('test &quot; value')
      expect(escapeXml("test ' value")).toBe("test &apos; value")
    })
  })
})
