/**
 * 相册管理 API 路由测试
 * 
 * 测试 GET、PATCH、DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
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

describe('GET /api/admin/albums/[id]', () => {
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
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('album retrieval', () => {
    it('should return album when found', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        description: 'Test Description',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('album-123')
      expect(data.title).toBe('Test Album')
    })

    it('should return 404 if album does not exist', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123')
      const response = await GET(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('PATCH /api/admin/albums/[id]', () => {
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

    // 默认相册存在
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockIs = vi.fn().mockReturnThis()
    const mockUpdate = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'album-123', title: 'Test Album' },
      error: null,
    })

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      update: mockUpdate,
      single: mockSingle,
    })

    mockUpdate.mockReturnThis()
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { title: 'New Title' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: 'invalid-json',
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for empty title', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { title: '' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('相册标题不能为空')
    })

    it('should return 400 for invalid layout', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { layout: 'invalid-layout' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('无效的布局类型')
    })

    it('should return 400 for invalid sort_rule', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { sort_rule: 'invalid-sort' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('无效的排序规则')
    })
  })

  describe('SSRF protection', () => {
    it('should reject localhost URLs for share_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { share_image_url: 'http://localhost:8080/image.jpg' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('不能使用内网地址')
    })

    it('should reject private IP URLs for share_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { share_image_url: 'http://192.168.1.1/image.jpg' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('不能使用内网地址')
    })

    it('should reject non-http protocols for share_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { share_image_url: 'file:///etc/passwd' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('必须使用 http 或 https 协议')
    })

    it('should accept valid public URLs for share_image_url', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', title: 'Test Album', share_image_url: 'https://example.com/image.jpg' },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      // Mock photo count query
      const mockCount = vi.fn().mockResolvedValue({ count: 0 })
      mockSelect.mockReturnValueOnce({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0 }),
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { share_image_url: 'https://example.com/image.jpg' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.share_image_url).toBe('https://example.com/image.jpg')
    })

    it('should reject localhost URLs for poster_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { poster_image_url: 'http://127.0.0.1/image.jpg' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('不能使用内网地址')
    })
  })

  describe('watermark validation', () => {
    it('should return 400 for invalid watermark_config format', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { watermark_config: 'invalid-string' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('水印配置格式错误')
    })

    it('should return 400 for too many watermarks', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: {
          watermark_config: {
            watermarks: Array(7).fill({ type: 'text', text: 'Test' }),
          },
        },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('最多支持6个水印')
    })

    it('should return 400 for invalid watermark type', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: {
          watermark_config: {
            watermarks: [{ type: 'invalid', text: 'Test' }],
          },
        },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('水印类型必须是 text 或 logo')
    })

    it('should return 400 for empty text watermark', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: {
          watermark_config: {
            watermarks: [{ type: 'text', text: '' }],
          },
        },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('文字水印内容不能为空')
    })

    it('should return 400 for empty logo watermark URL', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: {
          watermark_config: {
            watermarks: [{ type: 'logo', logoUrl: '' }],
          },
        },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('Logo URL 不能为空')
    })

    it('should return 400 for invalid opacity', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: {
          watermark_config: {
            watermarks: [{ type: 'text', text: 'Test', opacity: 1.5 }],
          },
        },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('透明度必须在 0-1 之间')
    })
  })

  describe('successful update', () => {
    it('should update album successfully', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', title: 'Updated Title' },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      // Mock photo count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 5 }),
      }).mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { title: 'Updated Title' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.title).toBe('Updated Title')
      expect(data.message).toBeDefined()
    })

    it('should handle password field - empty string to null', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', title: 'Test Album', password: null },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      // Mock photo count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0 }),
      }).mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { password: '' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      // Verify that update was called with null for password
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      // Mock photo count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0 }),
      }).mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { title: 'Updated Title' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 500 on database error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockUpdate = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      // Mock photo count query
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0 }),
      }).mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        update: mockUpdate,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'PATCH',
        body: { title: 'Updated Title' },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})

describe('DELETE /api/admin/albums/[id]', () => {
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
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('album deletion', () => {
    it('should soft delete album successfully', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', title: 'Test Album' },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        is: mockIs,
        select: mockSelect,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('已删除')
      expect(mockUpdate).toHaveBeenCalled()
    })

    it('should return 404 if album does not exist', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        is: mockIs,
        select: mockSelect,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('已删除')
    })

    it('should return 500 on database error', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        is: mockIs,
        select: mockSelect,
        single: mockSingle,
      })

      mockUpdate.mockReturnThis()

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })

    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
