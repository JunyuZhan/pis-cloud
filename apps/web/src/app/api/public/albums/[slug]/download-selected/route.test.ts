/**
 * 下载选中照片 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

describe('GET /api/public/albums/[slug]/download-selected', () => {
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createAdminClient } = await import('@/lib/supabase/server')
    mockAdminClient = createAdminClient()
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album does not allow download', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: false,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许下载')
    })

    it('should return 403 if album does not allow batch download', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许批量下载')
    })
  })

  describe('photo retrieval', () => {
    it('should return download links for selected photos successfully', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockPhotos = [
        {
          id: 'photo-1',
          filename: 'photo1.jpg',
          original_key: 'raw/album-123/photo-1.jpg',
        },
        {
          id: 'photo-2',
          filename: 'photo2.jpg',
          original_key: 'raw/album-123/photo-2.jpg',
        },
      ]

      // Mock album query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // Mock photos query - 需要链式调用：select().eq().eq().eq().order()
      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      // Set environment variable for media URL
      const originalMediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
      process.env.NEXT_PUBLIC_MEDIA_URL = 'https://media.example.com'

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // Restore environment variable
      if (originalMediaUrl) {
        process.env.NEXT_PUBLIC_MEDIA_URL = originalMediaUrl
      } else {
        delete process.env.NEXT_PUBLIC_MEDIA_URL
      }

      expect(response.status).toBe(200)
      expect(data.albumTitle).toBe('Test Album')
      expect(data.count).toBe(2)
      expect(data.photos).toHaveLength(2)
      expect(data.photos[0].id).toBe('photo-1')
      expect(data.photos[0].filename).toBe('photo1.jpg')
      expect(data.photos[0].url).toBe('https://media.example.com/raw/album-123/photo-1.jpg')
    })

    it('should return 400 if no photos are selected', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: [],
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('NO_SELECTION')
      expect(data.error.message).toContain('没有已选照片')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error when querying photos', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // 代码中会throw photosError，所以会被catch捕获返回500
      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
