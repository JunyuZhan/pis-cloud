import { describe, it, expect, vi, beforeEach } from 'vitest'
import { purgeCloudflareCache, buildImageUrl, purgePhotoCache } from './cloudflare-purge'

// Mock fetch
global.fetch = vi.fn()

describe('cloudflare-purge (worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CLOUDFLARE_ZONE_ID
    delete process.env.CLOUDFLARE_API_TOKEN
  })

  describe('purgeCloudflareCache', () => {
    it('should skip purge if zoneId or apiToken not configured', async () => {
      const result = await purgeCloudflareCache({
        urls: ['https://example.com/image.jpg'],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cloudflare API not configured')
      expect(result.failedUrls).toEqual(['https://example.com/image.jpg'])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should return success for empty URLs array', async () => {
      const result = await purgeCloudflareCache({
        urls: [],
        zoneId: 'test-zone-id',
        apiToken: 'test-token',
      })

      expect(result.success).toBe(true)
      expect(result.purgedUrls).toEqual([])
      expect(result.failedUrls).toEqual([])
    })

    it('should purge URLs successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const result = await purgeCloudflareCache({
        urls: ['https://example.com/image.jpg'],
        zoneId: 'test-zone-id',
        apiToken: 'test-token',
      })

      expect(result.success).toBe(true)
      expect(result.purgedUrls).toEqual(['https://example.com/image.jpg'])
      expect(result.failedUrls).toEqual([])
    })

    it('should batch URLs in groups of 30', async () => {
      const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/image${i}.jpg`)
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await purgeCloudflareCache({
        urls,
        zoneId: 'test-zone-id',
        apiToken: 'test-token',
      })

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle API errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ errors: ['Invalid zone'] }),
      } as Response)

      const result = await purgeCloudflareCache({
        urls: ['https://example.com/image.jpg'],
        zoneId: 'test-zone-id',
        apiToken: 'test-token',
      })

      expect(result.success).toBe(false)
      expect(result.failedUrls).toEqual(['https://example.com/image.jpg'])
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await purgeCloudflareCache({
        urls: ['https://example.com/image.jpg'],
        zoneId: 'test-zone-id',
        apiToken: 'test-token',
      })

      expect(result.success).toBe(false)
      expect(result.failedUrls).toEqual(['https://example.com/image.jpg'])
      // 注意：实际实现中，batch 错误会返回 "Failed to purge X URLs"
      expect(result.error).toBeDefined()
    })
  })

  describe('buildImageUrl', () => {
    it('should build correct image URL', () => {
      expect(buildImageUrl('https://media.example.com', 'processed/thumbs/123.jpg')).toBe(
        'https://media.example.com/processed/thumbs/123.jpg'
      )
    })
  })

  describe('purgePhotoCache', () => {
    beforeEach(() => {
      process.env.CLOUDFLARE_ZONE_ID = 'env-zone-id'
      process.env.CLOUDFLARE_API_TOKEN = 'env-token'
    })

    it('should purge all photo URLs', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const result = await purgePhotoCache(
        'https://media.example.com',
        {
          original_key: 'original/123.jpg',
          thumb_key: 'thumbs/123.jpg',
          preview_key: 'previews/123.jpg',
        }
      )

      expect(result.success).toBe(true)
      expect(result.purgedUrls).toHaveLength(3)
    })

    it('should return success for photo with no keys', async () => {
      const result = await purgePhotoCache('https://media.example.com', {})

      expect(result.success).toBe(true)
      expect(result.purgedUrls).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
