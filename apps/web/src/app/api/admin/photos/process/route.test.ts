/**
 * 照片处理触发 API 路由测试
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

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

// Mock global fetch
global.fetch = vi.fn()

describe('POST /api/admin/photos/process', () => {
  let mockAuth: any
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClient()
    mockAuth = mockSupabaseClient.auth
    
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

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
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
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for missing photoId', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('缺少必要参数')
    })

    it('should return 400 for missing albumId', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing originalKey', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('worker API call', () => {
    it('should call worker proxy API successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
      
      // 验证调用了正确的代理 URL
      const fetchCall = (global.fetch as any).mock.calls[0]
      expect(fetchCall[0]).toContain('/api/worker/process')
    })

    it('should handle worker API error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // Worker 错误时返回 202 Accepted（请求已接受，但处理尚未完成）
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.warning).toBeDefined()
      expect(data.warning.code).toBe('WORKER_UNAVAILABLE')
    })

    it('should handle worker API network error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 网络错误时返回 202 Accepted（请求已接受，但处理尚未完成）
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.warning).toBeDefined()
      expect(data.warning.code).toBe('WORKER_UNAVAILABLE')
    })

    it('should pass cookie header to worker API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        headers: {
          cookie: 'session=abc123',
        },
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 验证 cookie 被传递
      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.headers['cookie']).toBe('session=abc123')
    })
  })

  describe('error handling', () => {
    it('should return 500 on unexpected error', async () => {
      // Mock getUser to throw error
      mockAuth.getUser.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: 'photo-123',
          albumId: 'album-123',
          originalKey: 'raw/album-123/photo-123.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
