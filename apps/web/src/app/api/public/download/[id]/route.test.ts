/**
 * 原图下载 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

const mockPresignedGetObject = vi.fn().mockResolvedValue('https://minio.example.com/presigned-url')

vi.mock('minio', () => {
  // 使用类的方式定义mock
  class MockMinioClient {
    presignedGetObject = mockPresignedGetObject
  }

  return {
    Client: MockMinioClient,
  }
})


describe('GET /api/public/download/[id]', () => {
  let mockSupabaseClient: any
  let GET: typeof import('./route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules() // 清除模块缓存，确保每次测试都重新加载route模块
    
    const { createClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    
    // 重置并设置mock返回值
    mockPresignedGetObject.mockReset()
    mockPresignedGetObject.mockResolvedValue('https://minio.example.com/presigned-url')
    
    // 重新导入route模块以使用新的mock
    const routeModule = await import('./route')
    GET = routeModule.GET
  })

  describe('photo validation', () => {
    it('should return 404 if photo does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('照片不存在')
    })

    it('should return 404 if photo status is not completed', async () => {
      // 注意：代码中使用了 .eq('status', 'completed')，所以未完成的照片不会返回
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('album validation', () => {
    it('should return 404 if album is deleted', async () => {
      const mockPhoto = {
        id: 'photo-123',
        original_key: 'raw/album-123/photo-123.jpg',
        filename: 'photo.jpg',
        album_id: 'album-123',
        albums: {
          id: 'album-123',
          allow_download: true,
          deleted_at: '2024-01-01T00:00:00Z',
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('相册不存在')
    })

    it('should return 403 if album does not allow download', async () => {
      const mockPhoto = {
        id: 'photo-123',
        original_key: 'raw/album-123/photo-123.jpg',
        filename: 'photo.jpg',
        album_id: 'album-123',
        albums: {
          id: 'album-123',
          allow_download: false,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许下载原图')
    })
  })

  describe('presigned URL generation', () => {
    it('should generate presigned URL successfully', async () => {
      const mockPhoto = {
        id: 'photo-123',
        original_key: 'raw/album-123/photo-123.jpg',
        filename: 'photo.jpg',
        album_id: 'album-123',
        albums: {
          id: 'album-123',
          allow_download: true,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const mockDownloadUrl = 'https://minio.example.com/presigned-url'
      mockPresignedGetObject.mockResolvedValue(mockDownloadUrl)

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.downloadUrl).toBe(mockDownloadUrl)
      expect(data.filename).toBe('photo.jpg')
      expect(data.expiresIn).toBe(300) // 5 minutes
      
      // 验证 presignedGetObject 被调用（由于单例模式，可能不是第一次调用）
      expect(mockPresignedGetObject).toHaveBeenCalled()
    })

    it('should return download URL with correct format', async () => {
      const mockPhoto = {
        id: 'photo-123',
        original_key: 'raw/album-123/photo-123.jpg',
        filename: '照片 测试.jpg', // 包含中文字符和空格
        album_id: 'album-123',
        albums: {
          id: 'album-123',
          allow_download: true,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const mockDownloadUrl = 'https://minio.example.com/presigned-url'
      mockPresignedGetObject.mockResolvedValue(mockDownloadUrl)

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.downloadUrl).toBe(mockDownloadUrl)
      expect(data.filename).toBe('照片 测试.jpg')
      expect(data.expiresIn).toBe(300)
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on MinIO error', async () => {
      const mockPhoto = {
        id: 'photo-123',
        original_key: 'raw/album-123/photo-123.jpg',
        filename: 'photo.jpg',
        album_id: 'album-123',
        albums: {
          id: 'album-123',
          allow_download: true,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      mockPresignedGetObject.mockRejectedValue(new Error('MinIO error'))

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockRejectedValue(new Error('Database error'))

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/download/photo-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
