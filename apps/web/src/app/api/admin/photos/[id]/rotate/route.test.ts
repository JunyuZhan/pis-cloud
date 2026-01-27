/**
 * 照片旋转 API 路由测试
 * 
 * 测试 PATCH 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from './route'
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

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

vi.mock('@/lib/supabase/admin', () => {
  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

// Mock global fetch
global.fetch = vi.fn()

describe('PATCH /api/admin/photos/[id]/rotate', () => {
  let mockAuth: any
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    mockAuth = mockSupabaseClient.auth
    
    const { createAdminClient } = await import('@/lib/supabase/admin')
    mockAdminClient = createAdminClient()
    
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
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: 'invalid-json',
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for invalid rotation value', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 45 }, // 无效的角度
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('旋转角度必须是')
    })

    it('should accept valid rotation values', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 使用pending状态，避免触发worker调用
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: 90,
      }

      // Mock photo query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      // Mock admin update
      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      // Mock photo status query
      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.rotation).toBe(90)
    })

    it('should accept null rotation value', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 非completed状态，不需要重新处理
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: null },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.rotation).toBeNull()
    })
  })

  describe('photo validation', () => {
    it('should return 404 if photo does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: '2024-01-01T00:00:00Z', // 已删除
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('已被删除')
    })
  })

  describe('worker API integration', () => {
    it('should trigger reprocessing for completed photos', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      // Mock status update (when worker confirms)
      const mockAdminUpdate2 = vi.fn().mockReturnThis()
      const mockAdminEq3 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })
        .mockReturnValueOnce({
          update: mockAdminUpdate2,
          eq: mockAdminEq3,
        })

      mockAdminUpdate.mockReturnThis()
      mockAdminUpdate2.mockReturnThis()

      // Mock successful worker API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.needsReprocessing).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle worker API error gracefully', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      mockAdminUpdate.mockReturnThis()

      // Mock worker API error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Worker error' }),
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('WORKER_ERROR')
      expect(data.error.message).toContain('无法触发重新处理')
    })

    it('should handle worker API network error', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      mockAdminUpdate.mockReturnThis()

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('WORKER_ERROR')
      expect(data.error.message).toContain('无法连接到 Worker 服务')
    })

    it('should not trigger reprocessing for non-completed photos', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 非completed状态
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: 'photo-123',
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: mockUpdatedPhoto,
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          update: mockAdminUpdate,
          eq: mockAdminEq,
          select: mockAdminSelect,
          single: mockAdminSingle,
        })
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.needsReprocessing).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database update error', async () => {
      const mockPhoto = {
        id: 'photo-123',
        album_id: 'album-123',
        deleted_at: null,
        albums: {
          id: 'album-123',
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const mockAdminUpdate = vi.fn().mockReturnThis()
      const mockAdminEq = vi.fn().mockReturnThis()
      const mockAdminSelect = vi.fn().mockReturnThis()
      const mockAdminSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      })

      mockAdminClient.from.mockReturnValue({
        update: mockAdminUpdate,
        eq: mockAdminEq,
        select: mockAdminSelect,
        single: mockAdminSingle,
      })

      mockAdminUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/rotate', {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})
