import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { connection, QUEUE_NAME, photoQueue, queueEvents } from './redis.js'

// Mock bullmq
vi.mock('bullmq', () => {
  class MockQueue {
    private listeners: Map<string, Array<(...args: any[]) => void>> = new Map()
    
    on(event: string, callback: (...args: any[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
      this.listeners.get(event)!.push(callback)
      return this
    }
    
    emit(event: string, ...args: any[]) {
      const callbacks = this.listeners.get(event) || []
      callbacks.forEach(callback => callback(...args))
      return true
    }
  }
  
  class MockQueueEvents {
    private listeners: Map<string, Array<(...args: any[]) => void>> = new Map()
    
    on(event: string, callback: (...args: any[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
      this.listeners.get(event)!.push(callback)
      return this
    }
    
    emit(event: string, ...args: any[]) {
      const callbacks = this.listeners.get(event) || []
      callbacks.forEach(callback => callback(...args))
      return true
    }
  }
  
  return {
    Queue: MockQueue,
    Worker: vi.fn(),
    QueueEvents: MockQueueEvents,
  }
})

describe('redis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('connection', () => {
    it('should have default connection config', () => {
      expect(connection).toBeDefined()
      expect(connection.host).toBeDefined()
      expect(connection.port).toBeDefined()
      expect(connection.maxRetriesPerRequest).toBeNull()
    })

    it('should use environment variables', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        REDIS_HOST: 'custom-host',
        REDIS_PORT: '6380',
        REDIS_PASSWORD: 'custom-password',
      }

      // 重新导入以获取新的配置
      vi.resetModules()
      const { connection: newConnection } = await import('./redis.js')
      
      expect(newConnection.host).toBe('custom-host')
      expect(newConnection.port).toBe(6380)
      expect(newConnection.password).toBe('custom-password')

      process.env = originalEnv
    })
  })

  describe('QUEUE_NAME', () => {
    it('should have correct queue name', () => {
      expect(QUEUE_NAME).toBe('photo-processing')
    })
  })

  describe('photoQueue', () => {
    it('should be defined', () => {
      expect(photoQueue).toBeDefined()
    })
  })

  describe('queueEvents', () => {
    it('should be defined', () => {
      expect(queueEvents).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle photoQueue error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Redis connection error')
      
      // 触发错误事件
      photoQueue.emit('error', error)
      
      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle queueEvents error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('QueueEvents error')
      
      // 先触发 photoQueue 错误（如果之前没有触发过）
      photoQueue.emit('error', new Error('Previous error'))
      vi.advanceTimersByTime(31000) // 等待超过 30 秒间隔
      
      // 触发 queueEvents 错误
      queueEvents.emit('error', error)
      
      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should have retryStrategy in connection', () => {
      expect(connection.retryStrategy).toBeDefined()
      expect(typeof connection.retryStrategy).toBe('function')
      
      // 测试重试策略
      const delay1 = connection.retryStrategy!(1)
      const delay2 = connection.retryStrategy!(10)
      const delay100 = connection.retryStrategy!(1000)
      
      expect(delay1).toBeGreaterThan(0)
      expect(delay2).toBeGreaterThan(delay1)
      expect(delay100).toBe(30000) // 最大延迟
    })
  })
})
