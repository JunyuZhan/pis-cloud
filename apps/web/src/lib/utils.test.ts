import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cn, formatFileSize, formatDate, formatRelativeTime, getAppBaseUrl, getAlbumShareUrl } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(500)).toBe('500 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('should handle large file sizes', () => {
      expect(formatFileSize(2147483648)).toBe('2 GB')
    })
  })

  describe('formatDate', () => {
    it('should format date string', () => {
      const date = '2024-01-15T10:30:00Z'
      const result = formatDate(date)
      expect(result).toContain('2024年')
      expect(result).toContain('一月') // 实际实现使用中文月份名称
      expect(result).toContain('15日')
    })

    it('should format Date object', () => {
      const date = new Date('2024-12-25T10:30:00Z')
      const result = formatDate(date)
      expect(result).toContain('2024年')
      expect(result).toContain('十二月') // 实际实现使用中文月份名称
      expect(result).toContain('25日')
    })
  })

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return formatted date on server side', () => {
      const originalWindow = global.window
      // @ts-expect-error - intentionally removing window
      delete global.window

      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatRelativeTime(date)
      expect(result).toContain('2024年')

      global.window = originalWindow
    })

    it('should return "刚刚" for very recent time', () => {
      const now = new Date('2024-01-15T10:30:00Z')
      vi.setSystemTime(now)
      const date = new Date('2024-01-15T10:29:30Z')
      expect(formatRelativeTime(date)).toBe('刚刚')
    })

    it('should return minutes ago', () => {
      const now = new Date('2024-01-15T10:30:00Z')
      vi.setSystemTime(now)
      const date = new Date('2024-01-15T10:25:00Z')
      expect(formatRelativeTime(date)).toBe('5 分钟前')
    })

    it('should return hours ago', () => {
      const now = new Date('2024-01-15T10:30:00Z')
      vi.setSystemTime(now)
      const date = new Date('2024-01-15T08:30:00Z')
      expect(formatRelativeTime(date)).toBe('2 小时前')
    })

    it('should return days ago', () => {
      const now = new Date('2024-01-15T10:30:00Z')
      vi.setSystemTime(now)
      const date = new Date('2024-01-13T10:30:00Z')
      expect(formatRelativeTime(date)).toBe('2 天前')
    })

    it('should return formatted date for old dates', () => {
      const now = new Date('2024-01-15T10:30:00Z')
      vi.setSystemTime(now)
      const date = new Date('2023-12-01T10:30:00Z')
      const result = formatRelativeTime(date)
      expect(result).toContain('2023年')
    })
  })

  describe('getAppBaseUrl', () => {
    it('should return environment variable on server side', () => {
      const originalWindow = global.window
      // @ts-expect-error - intentionally removing window
      delete global.window

      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      expect(getAppBaseUrl()).toBe('https://example.com')

      delete process.env.NEXT_PUBLIC_APP_URL
      expect(getAppBaseUrl()).toBe('http://localhost:3000')

      global.window = originalWindow
    })

    it('should return window.location.origin on client side', () => {
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://client.example.com' },
        writable: true,
      })

      delete process.env.NEXT_PUBLIC_APP_URL
      expect(getAppBaseUrl()).toBe('https://client.example.com')
    })
  })

  describe('getAlbumShareUrl', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    })

    it('should generate share URL with slug', () => {
      expect(getAlbumShareUrl('my-album')).toBe('https://example.com/album/my-album')
    })

    it('should encode special characters in slug', () => {
      expect(getAlbumShareUrl('my album')).toBe('https://example.com/album/my%20album')
      expect(getAlbumShareUrl('album/123')).toBe('https://example.com/album/album%2F123')
    })

    it('should trim whitespace from slug', () => {
      expect(getAlbumShareUrl('  my-album  ')).toBe('https://example.com/album/my-album')
    })

    it('should throw error for invalid slug', () => {
      expect(() => getAlbumShareUrl('')).toThrow('Invalid album slug')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getAlbumShareUrl(null as any)).toThrow('Invalid album slug')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getAlbumShareUrl(undefined as any)).toThrow('Invalid album slug')
    })
  })
})
