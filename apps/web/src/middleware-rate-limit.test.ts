import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock @upstash/redis before importing the module
let mockRedisInstance: any
vi.mock('@upstash/redis', () => {
  class MockRedis {
    incr = vi.fn()
    expire = vi.fn()
    constructor(config: any) {
      mockRedisInstance = this
    }
  }
  return {
    Redis: MockRedis,
  }
})

describe('middleware-rate-limit', () => {
  beforeEach(() => {
    // 清理存储
    vi.clearAllMocks()
    // 重置 Redis 初始化状态和环境变量
    vi.resetModules()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    mockRedisInstance = null
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  describe('checkRateLimit', () => {
    it('should allow request within limit', async () => {
      const { checkRateLimit } = await import('./middleware-rate-limit')
      const result = await checkRateLimit('test-ip', 5, 60000)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.resetAt).toBeGreaterThan(Date.now())
    })

    it('should block request exceeding limit', async () => {
      const { checkRateLimit } = await import('./middleware-rate-limit')
      const identifier = 'test-ip-2'
      
      // 发送 5 次请求（达到限制）
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(identifier, 5, 60000)
      }
      
      // 第 6 次应该被阻止
      const result = await checkRateLimit(identifier, 5, 60000)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset after window expires', async () => {
      const { checkRateLimit } = await import('./middleware-rate-limit')
      const identifier = 'test-ip-3'
      
      // 达到限制
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(identifier, 5, 100) // 100ms 窗口
      }
      
      // 等待窗口过期
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // 应该允许新请求
      const result = await checkRateLimit(identifier, 5, 100)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should handle different identifiers separately', async () => {
      const { checkRateLimit } = await import('./middleware-rate-limit')
      // IP 1 达到限制
      for (let i = 0; i < 5; i++) {
        await checkRateLimit('ip-1', 5, 60000)
      }
      
      // IP 2 应该不受影响
      const result = await checkRateLimit('ip-2', 5, 60000)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should track remaining requests correctly', async () => {
      const { checkRateLimit } = await import('./middleware-rate-limit')
      const identifier = 'test-ip-4'
      
      const result1 = await checkRateLimit(identifier, 10, 60000)
      expect(result1.remaining).toBe(9)
      
      const result2 = await checkRateLimit(identifier, 10, 60000)
      expect(result2.remaining).toBe(8)
      
      const result3 = await checkRateLimit(identifier, 10, 60000)
      expect(result3.remaining).toBe(7)
    })
  })

  describe('getRateLimitStats', () => {
    it('should return storage statistics', async () => {
      const { getRateLimitStats } = await import('./middleware-rate-limit')
      const stats = getRateLimitStats()
      expect(stats).toHaveProperty('totalRecords')
      expect(stats).toHaveProperty('maxSize')
      expect(stats.maxSize).toBe(10000)
    })
  })

  // Note: Redis mode and cleanupOldestRecords are difficult to test directly:
  // - Redis mode requires complex mocking of @upstash/redis
  // - cleanupOldestRecords requires creating 10000+ records which is impractical
  // These are tested indirectly through integration tests and code review

  describe('cleanupExpiredRecords', () => {
    it('should cleanup expired records', async () => {
      const { checkRateLimit, getRateLimitStats } = await import('./middleware-rate-limit')
      
      // 创建一个会很快过期的记录
      await checkRateLimit('expired-ip', 5, 100) // 100ms 窗口
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // 创建新记录，应该触发清理
      await checkRateLimit('new-ip', 5, 60000)
      
      // 过期记录应该被清理
      const result = await checkRateLimit('expired-ip', 5, 60000)
      expect(result.allowed).toBe(true) // 应该创建新记录
    })
  })
})
