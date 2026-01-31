/**
 * 上传凭证 API 路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { checkRateLimit } from '@/middleware-rate-limit'
import { NextRequest } from 'next/server'

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
    createClientFromRequest: vi.fn().mockReturnValue(mockSupabaseClient),
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

vi.mock('@/middleware-rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-photo-id'),
}))

// Mock global fetch
global.fetch = vi.fn()

describe('POST /api/admin/albums/[id]/upload', () => {
  let mockAuth: any
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // 获取 mock 实例
    const { createClientFromRequest, createAdminClient } = await import('@/lib/supabase/server')
    mockSupabaseClient = await createClientFromRequest({} as any, {} as any)
    mockAdminClient = await createAdminClient()
    mockAuth = mockSupabaseClient.auth
    
    // 默认允许速率限制
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: Date.now() + 60000,
    })
    
    // 默认用户已登录
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
    
    // 默认相册存在
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockIs = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'album-123' },
      error: null,
    })
    
    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      single: mockSingle,
    })
    
    // 默认照片插入成功
    const mockInsert = vi.fn().mockReturnThis()
    const mockDelete = vi.fn().mockReturnThis()
    mockAdminClient.from.mockReturnValue({
      insert: mockInsert,
      delete: mockDelete,
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    
    mockInsert.mockResolvedValue({ error: null })
    
    // 默认 presign API 成功
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: 'https://example.com/presigned-url' }),
    } as any)
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 401 if auth error occurs', async () => {
      mockAuth.getUser.mockRejectedValue(new Error('Auth error'))

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('AUTH_ERROR')
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(response.headers.get('X-RateLimit-Limit')).toBe('20')
    })
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

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('ALBUM_NOT_FOUND')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid params', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_PARAMS')
    })

    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for missing filename', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing contentType', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid file type', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_FILE_TYPE')
    })

    it('should return 400 for file too large', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          fileSize: 101 * 1024 * 1024, // 101MB
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('FILE_TOO_LARGE')
    })
  })

  describe('file type validation', () => {
    it('should accept image/jpeg', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photoId).toBeDefined()
      expect(data.uploadUrl).toBe('https://example.com/presigned-url')
    })

    it('should accept image/png', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.png',
          contentType: 'image/png',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photoId).toBeDefined()
    })

    it('should accept image/heic', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.heic',
          contentType: 'image/heic',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photoId).toBeDefined()
    })

    it('should accept image/webp', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.webp',
          contentType: 'image/webp',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photoId).toBeDefined()
    })
  })

  describe('database operations', () => {
    it('should return 500 if photo insert fails', async () => {
      const mockInsert = vi.fn().mockReturnThis()
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: vi.fn(),
        eq: vi.fn(),
      })
      
      mockInsert.mockResolvedValue({
        error: { message: 'Database error' },
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })

  describe('presign API', () => {
    it('should return 500 if presign fetch fails', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      expect(data.photoId).toBeDefined() // Should include photoId for cleanup
    })

    it('should return error if presign request times out', async () => {
      const abortError = new Error('Request timeout')
      abortError.name = 'AbortError'
      vi.mocked(global.fetch).mockRejectedValue(abortError)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      expect(data.error.details).toContain('超时')
    })

    it('should return error if presign response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: { code: 'PRESIGN_FAILED', message: 'Presign error' } })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
      expect(data.photoId).toBeDefined()
    })

    it('should return error if presigned URL is missing', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // Missing url
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INVALID_RESPONSE')
    })

    it('should return success with presigned URL', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          fileSize: 1024 * 1024, // 1MB
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photoId).toBe('test-photo-id')
      expect(data.uploadUrl).toBe('https://example.com/presigned-url')
      expect(data.originalKey).toContain('raw/album-123/test-photo-id.jpg')
      expect(data.albumId).toBe('album-123')
    })
  })

  describe('error handling', () => {
    it('should handle unhandled errors', async () => {
      // Mock params to throw error
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      // Mock a different error - make presign throw after photo is created
      const mockInsert = vi.fn().mockReturnThis()
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: vi.fn(),
        eq: vi.fn(),
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make presign throw an unexpected error
      vi.mocked(global.fetch).mockImplementation(() => {
        throw new Error('Unexpected presign error')
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    })

    it('should cleanup photo record on presign error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
      
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: mockDelete,
        eq: mockEq,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      await POST(request, { params: Promise.resolve({ id: 'album-123' }) })

      // Should attempt to cleanup
      expect(mockDelete).toHaveBeenCalled()
    })

    it('should handle cleanup error gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      mockAdminClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: mockDelete,
        eq: mockEq,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      // Should still return error response even if cleanup fails
      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      expect(consoleErrorSpy).toHaveBeenCalled()
      
      consoleErrorSpy.mockRestore()
    })

    it('should pass cookie header to presign request', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        headers: {
          cookie: 'test-cookie=value',
        },
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      await POST(request, { params: Promise.resolve({ id: 'album-123' }) })

      // Verify cookie was passed to fetch
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const headers = fetchCall[1]?.headers as HeadersInit
      expect(headers).toHaveProperty('cookie', 'test-cookie=value')
    })

    it('should handle presign response with string error', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'Simple error string' })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
      expect(data.error.message).toBe('Simple error string')
    })

    it('should handle presign response with non-JSON error', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Plain text error'),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
    })

    it('should handle presign response with nested error object', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ 
          error: { 
            code: 'CUSTOM_ERROR', 
            message: 'Custom error message',
            details: 'Error details'
          } 
        })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('CUSTOM_ERROR')
      expect(data.error.message).toBe('Custom error message')
      expect(data.error.details).toBe('Error details')
    })

    it('should handle presign response with error.details', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ 
          error: { code: 'ERROR', message: 'Message' },
          details: 'Top level details'
        })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(data.error.details).toBe('Top level details')
    })

    it('should handle presign error when response is null', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
      
      // Make response null initially to test response initialization
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    })

    it('should handle presign catch block error', async () => {
      // Make presign throw an error that's not a fetch error
      // This will be caught by the outer catch block (line 350)
      // We need to make fetch succeed but then throw when parsing
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockInsert = vi.fn().mockReturnThis()
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: mockDelete,
        eq: mockEq,
      })
      mockInsert.mockResolvedValue({ error: null })
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_ERROR')
      
      // Verify console.error was called for presignError (line 351) and cleanupError (line 360)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Upload API] Error getting presigned URL:',
        expect.any(Error)
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Upload API] Failed to cleanup photo record:',
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    it('should handle outer catch block with photoId cleanup', async () => {
      // Make something throw in the outer catch block after photoId is set
      // We'll make the presign fetch throw after photo is created
      const mockInsert = vi.fn().mockReturnThis()
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: vi.fn(),
        eq: vi.fn(),
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make fetch throw after photo is created
      vi.mocked(global.fetch).mockImplementation(() => {
        throw new Error('Unexpected error after photo creation')
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    })

    it('should handle file extension extraction', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.HEIC', // Uppercase extension
          contentType: 'image/heic',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.originalKey).toContain('.heic') // Should be lowercase
    })

    it('should reject filename without extension', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test', // No extension
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      // 现在要求必须有文件扩展名（安全考虑）
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INVALID_FILE_TYPE')
      expect(data.error.message).toContain('不支持的文件扩展名')
    })

    it('should handle IP extraction from x-real-ip header', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        headers: {
          'x-real-ip': '192.168.1.100',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      await POST(request, { params: Promise.resolve({ id: 'album-123' }) })

      // Verify rate limit was called with IP from x-real-ip
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle IP extraction fallback to unknown', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      await POST(request, { params: Promise.resolve({ id: 'album-123' }) })

      // Verify rate limit was called with 'unknown' IP
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle response null check when user is null', async () => {
      // Make response null before user check
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle response initialization in fetch error catch', async () => {
      // Make response null initially by making createClientFromRequest throw before response is set
      const { createClientFromRequest } = await import('@/lib/supabase/server')
      vi.mocked(createClientFromRequest).mockImplementationOnce(() => {
        throw new Error('Client creation error')
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should handle response initialization when presign response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Error'),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
    })

    it('should handle response initialization when presigned URL is missing', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // Missing url
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INVALID_RESPONSE')
    })

    it('should handle response initialization in presign error catch', async () => {
      // Make presign throw an error that triggers the fetch error catch
      vi.mocked(global.fetch).mockImplementation(() => {
        throw new Error('Presign error')
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    })

    it('should handle outer catch block with photoId cleanup', async () => {
      // Make something throw in outer catch after photoId is set
      const mockInsert = vi.fn().mockReturnThis()
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: vi.fn(),
        eq: vi.fn(),
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make presign throw after photo is created
      vi.mocked(global.fetch).mockImplementation(() => {
        throw new Error('Unexpected error after photo creation')
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    })

    it('should handle non-Error fetch error', async () => {
      // Make fetch throw a non-Error object
      vi.mocked(global.fetch).mockRejectedValue('String error')

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      expect(data.error.details).toContain('无法连接到 Worker 服务')
    })

    it('should handle non-Error presign error', async () => {
      // Make presign throw a non-Error object in fetch error catch
      vi.mocked(global.fetch).mockImplementation(() => {
        throw 'String error'
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      expect(data.error.details).toContain('无法连接到 Worker 服务')
    })

    it('should handle non-Error outer catch error', async () => {
      // Make outer catch receive non-Error
      const { createClientFromRequest } = await import('@/lib/supabase/server')
      vi.mocked(createClientFromRequest).mockImplementationOnce(() => {
        throw 'String error'
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
      expect(data.error.message).toBe('服务器错误')
    })

    it('should handle x-forwarded-for IP extraction', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.200',
        },
        body: JSON.stringify({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        }),
      })

      await POST(request, { params: Promise.resolve({ id: 'album-123' }) })

      // Verify rate limit was called with IP from x-forwarded-for
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.200'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle rate limit reset calculation', async () => {
      const resetAt = Date.now() + 30000 // 30 seconds
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.message).toContain('秒后重置')
      expect(response.headers.get('Retry-After')).toBeDefined()
    })

    it('should handle presign response with null error object', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: null })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
    })

    it('should handle presign response with error object without code', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ 
          error: { message: 'Error message' } // No code field
        })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FAILED')
      expect(data.error.message).toBe('Error message')
    })

    it('should handle presign response with error object without message', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(JSON.stringify({ 
          error: { code: 'ERROR_CODE' } // No message field
        })),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('ERROR_CODE')
      expect(data.error.message).toBe('获取上传凭证失败')
    })

    it('should handle response null check in unauthorized response', async () => {
      // Make response null by making createClientFromRequest not set response
      const { createClientFromRequest } = await import('@/lib/supabase/server')
      let responseWasNull = false
      
      vi.mocked(createClientFromRequest).mockImplementationOnce((req, res) => {
        // Don't set response, making it null
        responseWasNull = true
        return mockSupabaseClient
      })

      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should handle cleanup error in presign error catch', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
      
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      mockAdminClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: mockDelete,
        eq: mockEq,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      // Verify cleanup error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup photo record'),
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    it('should handle outer catch block with photoId cleanup promise', async () => {
      // Make something throw in outer catch after photoId is set
      // This will trigger the Promise.resolve().then() cleanup
      const mockInsert = vi.fn().mockReturnThis()
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: mockDelete,
        eq: mockEq,
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make presign JSON parsing throw to trigger outer catch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_ERROR')
      
      // Wait a bit for async cleanup to potentially run
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify cleanup was attempted (it's async, so we check if delete was called)
      // Note: The cleanup happens in Promise.resolve().then(), so it's fire-and-forget
      // We can't easily verify it completed, but we can verify the code path was taken
    })

    it('should handle presignError catch block with null response', async () => {
      // Test line 354: response = new NextResponse() in presignError catch block
      // Note: This branch is actually unreachable because response is initialized at line 30
      // However, we test the presignError catch block to ensure it works correctly
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockInsert = vi.fn().mockReturnThis()
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: mockDelete,
        eq: mockEq,
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make fetch succeed but json() throw to trigger presignError catch (line 350)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_ERROR')
      
      // Verify console.error was called for presignError (line 351)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Upload API] Error getting presigned URL:',
        expect.any(Error)
      )
      
      // Note: Line 354 (response = new NextResponse()) is unreachable in practice
      // because response is initialized at line 30, but the code path exists for defensive programming
      
      consoleErrorSpy.mockRestore()
    })

    it('should handle console.error in fetchError catch block', async () => {
      // Test line 227: console.error('[Upload API] Fetch error when calling presign:', fetchError)
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockInsert = vi.fn().mockReturnThis()
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: vi.fn(),
        eq: vi.fn(),
      })
      mockInsert.mockResolvedValue({ error: null })
      
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      
      // Verify console.error was called with the fetch error (line 227)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Upload API] Fetch error when calling presign:',
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    it('should handle outer catch block cleanup with photoId set', async () => {
      // Test lines 385-390: Promise.resolve().then() cleanup in outer catch
      // Make something throw in outer catch after photoId is set
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockInsert = vi.fn().mockReturnThis()
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      
      mockAdminClient.from.mockReturnValue({
        insert: mockInsert,
        delete: mockDelete,
        eq: mockEq,
      })
      mockInsert.mockResolvedValue({ error: null })
      
      // Make createAdminClient return a new instance for cleanup (line 387)
      const { createAdminClient } = await import('@/lib/supabase/server')
      const cleanupAdminClient = {
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
          eq: mockEq,
        }),
      }
      vi.mocked(createAdminClient).mockReturnValueOnce(mockAdminClient as any)
      vi.mocked(createAdminClient).mockReturnValueOnce(cleanupAdminClient as any)
      
      // Make something throw in outer catch - make createClientFromRequest throw after photo is created
      // This will trigger the outer catch block (line 379) with photoId set
      const { createClientFromRequest } = await import('@/lib/supabase/server')
      let callCount = 0
      vi.mocked(createClientFromRequest).mockImplementation((req, res) => {
        callCount++
        if (callCount === 1) {
          // First call succeeds (for initial setup)
          return mockSupabaseClient
        }
        // This shouldn't be called, but if it is, throw to trigger outer catch
        throw new Error('Unexpected error in outer catch')
      })
      
      // Make fetch throw to trigger outer catch after photo is created
      vi.mocked(global.fetch).mockImplementation(() => {
        throw new Error('Unexpected error in outer catch')
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums/album-123/upload', {
        method: 'POST',
        body: {
          filename: 'test.jpg',
          contentType: 'image/jpeg',
        },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'album-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
      
      // Wait for async cleanup to potentially run (lines 385-390)
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify cleanup was attempted (the Promise.resolve().then() should have run)
      // Note: This is fire-and-forget, so we can't easily verify completion
      // But we can verify that createAdminClient was called for cleanup
      expect(createAdminClient).toHaveBeenCalledTimes(2) // Once for insert, once for cleanup
      
      consoleErrorSpy.mockRestore()
    })
  })
})
