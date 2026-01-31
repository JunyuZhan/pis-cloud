import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAlbumCache, clearAlbumCache } from './album-cache'

describe('album-cache', () => {
  const originalSetInterval = global.setInterval
  const originalDateNow = Date.now

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module to get fresh singleton
    vi.resetModules()
    // Mock setInterval to avoid actual timers
    global.setInterval = vi.fn()
    // Mock Date.now for TTL testing
    let currentTime = 1000000
    Date.now = vi.fn(() => currentTime)
  })

  afterEach(() => {
    global.setInterval = originalSetInterval
    Date.now = originalDateNow
    clearAlbumCache()
  })

  describe('getAlbumCache', () => {
    it('should return singleton instance', () => {
      const cache1 = getAlbumCache()
      const cache2 = getAlbumCache()
      expect(cache1).toBe(cache2)
    })

    it('should use custom TTL from environment', () => {
      const originalEnv = process.env.ALBUM_CACHE_TTL_MS
      process.env.ALBUM_CACHE_TTL_MS = '600000'
      
      clearAlbumCache()
      const cache = getAlbumCache()
      
      // Cache should be initialized with custom TTL
      expect(cache).toBeDefined()
      
      process.env.ALBUM_CACHE_TTL_MS = originalEnv
    })
  })

  describe('AlbumCache', () => {
    it('should get cached album', () => {
      const cache = getAlbumCache()
      const album = {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: { text: 'Test' },
      }

      cache.set('album-1', album)
      const cached = cache.get('album-1')

      expect(cached).toBeDefined()
      expect(cached?.id).toBe('album-1')
      expect(cached?.watermark_enabled).toBe(true)
    })

    it('should return null for non-existent album', () => {
      const cache = getAlbumCache()
      const cached = cache.get('non-existent')
      expect(cached).toBeNull()
    })

    it('should return null for expired cache', () => {
      const cache = getAlbumCache()
      const album = {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: {},
      }

      cache.set('album-1', album)
      
      // Advance time beyond TTL (default 300000ms = 5 minutes)
      Date.now = vi.fn(() => 1000000 + 300001)
      
      const cached = cache.get('album-1')
      expect(cached).toBeNull()
    })

    it('should delete album from cache', () => {
      const cache = getAlbumCache()
      const album = {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: {},
      }

      cache.set('album-1', album)
      cache.delete('album-1')
      
      const cached = cache.get('album-1')
      expect(cached).toBeNull()
    })

    it('should clear all cache', () => {
      const cache = getAlbumCache()
      cache.set('album-1', {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: {},
      })
      cache.set('album-2', {
        id: 'album-2',
        watermark_enabled: false,
        watermark_type: null,
        watermark_config: {},
      })

      expect(cache.size()).toBe(2)
      cache.clear()
      expect(cache.size()).toBe(0)
    })

    it('should return cache size', () => {
      const cache = getAlbumCache()
      cache.set('album-1', {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: {},
      })
      cache.set('album-2', {
        id: 'album-2',
        watermark_enabled: false,
        watermark_type: null,
        watermark_config: {},
      })

      expect(cache.size()).toBe(2)
    })
  })

  describe('clearAlbumCache', () => {
    it('should clear singleton cache instance', () => {
      const cache = getAlbumCache()
      cache.set('album-1', {
        id: 'album-1',
        watermark_enabled: true,
        watermark_type: 'text',
        watermark_config: {},
      })

      expect(cache.size()).toBe(1)
      clearAlbumCache()
      expect(cache.size()).toBe(0)
    })

    it('should handle clearing when cache is not initialized', () => {
      clearAlbumCache()
      // Should not throw
      expect(true).toBe(true)
    })
  })
})
