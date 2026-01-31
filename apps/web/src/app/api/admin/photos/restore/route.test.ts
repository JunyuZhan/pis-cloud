/**
 * 照片恢复 API 路由测试
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POST /api/admin/photos/restore', () => {
  let mockAuth: any
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    mockAuth = mockSupabaseClient.auth
    mockAdminClient = createAdminClient()
    
    // 默认用户已登录
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for empty photoIds array', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: [] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('请选择要恢复的照片')
    })

    it('should return 400 for non-array photoIds', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: 'not-an-array' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for photoIds exceeding limit', async () => {
      const photoIds = Array.from({ length: 101 }, (_, i) => `photo-${i}`)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('单次最多恢复100张照片')
    })
  })

  describe('photo validation', () => {
    it('should return 404 if no deleted photos found', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('未找到已删除的照片')
    })

    it('should return 500 on database error when checking photos', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })

  describe('successful restore', () => {
    it('should restore photos successfully', async () => {
      const mockDeletedPhotos = [
        { id: 'photo-1', album_id: 'album-123', deleted_at: '2024-01-01T00:00:00Z' },
        { id: 'photo-2', album_id: 'album-123', deleted_at: '2024-01-01T00:00:00Z' },
      ]

      const mockAlbums = [
        { id: 'album-123', slug: 'test-album' },
      ]

      // Mock deleted photos query
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockDeletedPhotos,
        error: null,
      })

      // Mock restore update
      const mockUpdate = vi.fn().mockReturnThis()
      const mockIn2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      // Mock albums query
      const mockSelect2 = vi.fn().mockReturnThis()
      const mockIn3 = vi.fn().mockResolvedValue({
        data: mockAlbums,
        error: null,
      })

      // Mock photo count query
      const mockSelect3 = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockResolvedValue({
        count: 5,
        data: null,
        error: null,
      })

      // Mock album update
      const mockUpdate2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
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
          update: mockUpdate,
          in: mockIn2,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          in: mockIn3,
        })
        .mockReturnValueOnce({
          select: mockSelect3,
          eq: mockEq,
          is: mockIs,
        })
        .mockReturnValueOnce({
          update: mockUpdate2,
          eq: mockEq2,
        })

      mockUpdate.mockReturnThis()
      mockUpdate2.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1', 'photo-2'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.restoredCount).toBe(2)
      expect(data.message).toContain('已恢复 2 张照片')
    })

    it('should update album photo count after restore', async () => {
      const mockDeletedPhotos = [
        { id: 'photo-1', album_id: 'album-123', deleted_at: '2024-01-01T00:00:00Z' },
      ]

      const mockAlbums = [
        { id: 'album-123', slug: 'test-album' },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockDeletedPhotos,
        error: null,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockIn2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      const mockSelect2 = vi.fn().mockReturnThis()
      const mockIn3 = vi.fn().mockResolvedValue({
        data: mockAlbums,
        error: null,
      })

      const mockSelect3 = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockResolvedValue({
        count: 10,
        data: null,
        error: null,
      })

      const mockUpdate2 = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
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
          update: mockUpdate,
          in: mockIn2,
        })
        .mockReturnValueOnce({
          select: mockSelect2,
          in: mockIn3,
        })
        .mockReturnValueOnce({
          select: mockSelect3,
          eq: mockEq,
          is: mockIs,
        })
        .mockReturnValueOnce({
          update: mockUpdate2,
          eq: mockEq2,
        })

      mockUpdate.mockReturnThis()
      mockUpdate2.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证相册照片计数被更新
      expect(mockUpdate2).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 on restore error', async () => {
      const mockDeletedPhotos = [
        { id: 'photo-1', album_id: 'album-123', deleted_at: '2024-01-01T00:00:00Z' },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockDeletedPhotos,
        error: null,
      })

      const mockUpdate = vi.fn().mockReturnThis()
      const mockIn2 = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
          in: mockIn2,
        })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['photo-1'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})
