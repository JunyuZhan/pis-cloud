/**
 * 照片永久删除 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockAuth = {
    getUser: vi.fn(),
  }

  const mockSupabaseClient = {
    auth: mockAuth,
    from: vi.fn(),
  }

  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

vi.mock('@/lib/cloudflare-purge', () => ({
  purgePhotoCache: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock global fetch
global.fetch = vi.fn()

describe('POST /api/admin/photos/permanent-delete', () => {
  let mockAuth: any
  let mockSupabaseClient: any
  let mockAdminClient: any
  let purgePhotoCache: any
  let revalidatePath: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    mockAuth = mockSupabaseClient.auth
    mockAdminClient = createAdminClient()
    
    const { purgePhotoCache: purgeMock } = await import('@/lib/cloudflare-purge')
    purgePhotoCache = purgeMock
    
    const { revalidatePath: revalidateMock } = await import('next/cache')
    revalidatePath = revalidateMock
    
    // 默认用户已登录
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })

    // 默认 Cloudflare purge 成功
    purgePhotoCache.mockResolvedValue({
      success: true,
      purgedUrls: [],
      failedUrls: [],
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 if photoIds is not an array', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: 'not-an-array',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('请选择要删除的照片')
    })

    it('should return 400 if photoIds is empty', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: [],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if photoIds exceeds limit', async () => {
      const photoIds = Array.from({ length: 101 }, (_, i) => `photo-${i}`)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('单次最多删除100张照片')
    })
  })

  describe('photo validation', () => {
    it('should return 404 if no valid photos found', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('未找到有效的照片')
    })

    it('should return 500 on database query error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })

    it('should only delete photos that are in trash (deleted_at is not null)', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: 'thumbs/album-123/photo-123.jpg',
          preview_key: 'previews/album-123/photo-123.jpg',
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(1)
      
      // 验证只查询已删除的照片
      expect(mockNot).toHaveBeenCalledWith('deleted_at', 'is', null)
    })
  })

  describe('file deletion', () => {
    it('should delete all MinIO files (original, thumb, preview)', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: 'thumbs/album-123/photo-123.jpg',
          preview_key: 'previews/album-123/photo-123.jpg',
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证调用了 Worker API 删除所有文件
      expect(global.fetch).toHaveBeenCalledTimes(3) // original, thumb, preview
      
      const fetchCalls = (global.fetch as any).mock.calls
      const cleanupFileCalls = fetchCalls.filter((call: any[]) => 
        call[0].includes('/api/worker/cleanup-file')
      )
      expect(cleanupFileCalls.length).toBe(3)
    })

    it('should skip null file keys', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 只应该删除 original_key
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should continue deletion even if MinIO cleanup fails', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      // MinIO cleanup 失败
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 即使 MinIO 删除失败，数据库记录也应该被删除
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('CDN cache purge', () => {
    it('should purge CDN cache when configured', async () => {
      const originalEnv = process.env
      process.env.NEXT_PUBLIC_MEDIA_URL = 'https://media.example.com'
      process.env.CLOUDFLARE_ZONE_ID = 'zone-123'
      process.env.CLOUDFLARE_API_TOKEN = 'token-123'

      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: 'thumbs/album-123/photo-123.jpg',
          preview_key: 'previews/album-123/photo-123.jpg',
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      purgePhotoCache.mockResolvedValue({
        success: true,
        purgedUrls: [],
        failedUrls: [],
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证调用了 CDN purge
      expect(purgePhotoCache).toHaveBeenCalled()

      process.env = originalEnv
    })

    it('should skip CDN purge if not configured', async () => {
      const originalEnv = process.env
      delete process.env.NEXT_PUBLIC_MEDIA_URL
      delete process.env.CLOUDFLARE_ZONE_ID
      delete process.env.CLOUDFLARE_API_TOKEN

      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 不应该调用 CDN purge
      expect(purgePhotoCache).not.toHaveBeenCalled()

      process.env = originalEnv
    })
  })

  describe('database operations', () => {
    it('should delete photo records from database', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteIn).toHaveBeenCalledWith('id', ['photo-123'])
    })

    it('should return 500 on database deletion error', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })

      mockDelete.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })

    it('should update album cover if cover photo is deleted', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: 'photo-123', // 封面照片被删除
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
          eq: mockUpdateEq,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证更新了相册封面
      expect(mockUpdate).toHaveBeenCalledWith({ cover_photo_id: null })
    })

    it('should update album photo count', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证更新了相册照片计数
      expect(mockUpdate).toHaveBeenCalledWith({ photo_count: 5 })
    })
  })

  describe('cache revalidation', () => {
    it('should revalidate Next.js cache paths', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          thumb_key: null,
          preview_key: null,
        },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      const mockAlbumsSelect = vi.fn().mockReturnThis()
      const mockAlbumsIn = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'album-123',
            slug: 'test-album',
            cover_photo_id: null,
          },
        ],
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockDeleteIn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        count: 5,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockUpdateEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          select: mockAlbumsSelect,
          in: mockAlbumsIn,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          in: mockDeleteIn,
        })
        .mockReturnValueOnce({
          select: mockCountSelect,
          eq: mockCountEq,
          is: mockCountIs,
        })
        .mockReturnValue({
          update: mockUpdate,
          eq: mockUpdateEq,
        })

      mockDelete.mockReturnThis()
      mockCountSelect.mockReturnThis()
      mockCountEq.mockReturnThis()
      mockUpdate.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证调用了 revalidatePath
      expect(revalidatePath).toHaveBeenCalledTimes(4)
      expect(revalidatePath).toHaveBeenCalledWith('/api/public/albums/test-album/photos')
      expect(revalidatePath).toHaveBeenCalledWith('/api/public/albums/test-album/groups')
      expect(revalidatePath).toHaveBeenCalledWith('/api/public/albums/test-album')
      expect(revalidatePath).toHaveBeenCalledWith('/album/test-album')
    })
  })

  describe('error handling', () => {
    it('should return 500 on unexpected error', async () => {
      mockAuth.getUser.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/permanent-delete', {
        method: 'POST',
        body: {
          photoIds: ['photo-123'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
