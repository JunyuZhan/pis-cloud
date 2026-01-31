/**
 * 照片清理 API 路由测试
 * 
 * 测试 DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
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

// Mock global fetch
global.fetch = vi.fn()

describe('DELETE /api/admin/photos/[id]/cleanup', () => {
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

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('photo validation', () => {
    it('should return success if photo does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('可能已被清理')
    })

    it('should return 400 if photo status is not pending or failed', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'completed',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_STATUS')
      expect(data.error.message).toContain('只能清理pending或failed状态的照片')
    })

    it('should allow cleanup for pending status', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('已清理')
    })

    it('should allow cleanup for failed status', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'failed',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('MinIO cleanup', () => {
    it('should call Worker API to cleanup MinIO file', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should continue cleanup even if MinIO cleanup fails', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: 'raw/album-123/photo-123.jpg',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      // MinIO cleanup fails
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      // 即使 MinIO 清理失败，数据库记录也应该被删除
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should skip MinIO cleanup if original_key is null', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 如果没有 original_key，不应该调用 Worker API
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('database deletion', () => {
    it('should delete photo record successfully', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
    })

    it('should return 500 on database deletion error', async () => {
      const mockPhoto = {
        id: 'photo-123',
        status: 'pending',
        album_id: 'album-123',
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
          eq: mockEq2,
        })

      mockDelete.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'photo-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/photo-123/cleanup', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
