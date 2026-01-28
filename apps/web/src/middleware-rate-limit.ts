/**
 * 速率限制工具
 * 
 * 支持两种模式：
 * 1. 内存存储（默认）：单服务器部署时使用
 * 2. Redis 存储（可选）：多服务器部署时使用，需要配置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN
 * 
 * 安全特性：
 * - 自动清理过期记录，防止内存泄漏
 * - 限制存储大小，防止内存耗尽攻击
 * - 支持基于 IP、邮箱等多维度限制
 * - 支持分布式速率限制（Redis 模式）
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
    createdAt: number
  }
}

const store: RateLimitStore = {}

// 最大存储记录数（防止内存耗尽攻击）
const MAX_STORE_SIZE = 10000

// Redis 客户端类型（来自 @upstash/redis）
type RedisClient = {
  incr: (key: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
}

// Redis 客户端（可选，仅在配置了 Redis 时使用）
let redisClient: RedisClient | null = null
let redisInitialized = false

// 初始化 Redis 客户端（延迟初始化，避免在模块加载时阻塞）
async function initRedis(): Promise<RedisClient | null> {
  if (redisInitialized) return redisClient
  
  redisInitialized = true
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!redisUrl || !redisToken) {
    return null
  }
  
  try {
    // 动态导入 @upstash/redis（避免在未安装时出错）
    const { Redis } = await import('@upstash/redis')
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    }) as RedisClient
    console.log('✅ Rate limit: Redis mode enabled')
    return redisClient
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.warn('⚠️ Rate limit: Failed to initialize Redis, falling back to memory storage:', errorMessage)
    return null
  }
}

/**
 * 速率限制检查
 * @param identifier 标识符（如 IP 地址或用户 ID）
 * @param maxRequests 最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns 是否允许请求
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  
  // 尝试初始化 Redis（如果尚未初始化）
  const client = await initRedis()
  
  // 如果 Redis 可用，使用 Redis 存储（分布式速率限制）
  if (client) {
    try {
      const key = `rate_limit:${identifier}`
      const windowSeconds = Math.ceil(windowMs / 1000)
      
      // 使用 Redis INCR 和 EXPIRE 实现滑动窗口
      const count = await client.incr(key)
      
      // 如果是新键，设置过期时间
      if (count === 1) {
        await client.expire(key, windowSeconds)
      }
      
      const allowed = count <= maxRequests
      const resetAt = now + windowMs
      
      return {
        allowed,
        remaining: Math.max(0, maxRequests - count),
        resetAt,
      }
    } catch (err) {
      // Redis 操作失败，回退到内存存储
      console.warn('⚠️ Rate limit: Redis operation failed, falling back to memory storage:', err)
    }
  }
  
  // 内存存储模式（单服务器部署）
  // 清理过期记录（每次检查时清理，避免内存泄漏）
  cleanupExpiredRecords()
  
  // 如果存储过大，清理最旧的记录
  if (Object.keys(store).length >= MAX_STORE_SIZE) {
    cleanupOldestRecords()
  }

  const key = identifier
  const record = store[key]

  // 如果记录不存在或已过期，创建新记录
  if (!record || now > record.resetAt) {
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
      createdAt: now,
    }
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // 如果未超过限制
  if (record.count < maxRequests) {
    record.count++
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetAt: record.resetAt,
    }
  }

  // 超过限制
  return {
    allowed: false,
    remaining: 0,
    resetAt: record.resetAt,
  }
}

/**
 * 清理过期的记录
 */
function cleanupExpiredRecords() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  Object.keys(store).forEach((key) => {
    if (now > store[key].resetAt) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach((key) => {
    delete store[key]
  })
}

/**
 * 清理最旧的记录（当存储过大时）
 */
function cleanupOldestRecords() {
  const entries = Object.entries(store)
  
  // 按创建时间排序，删除最旧的 10%
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt)
  const toDelete = entries.slice(0, Math.floor(entries.length * 0.1))
  
  toDelete.forEach(([key]) => {
    delete store[key]
  })
}

/**
 * 获取当前存储统计信息（用于监控）
 */
export function getRateLimitStats() {
  return {
    totalRecords: Object.keys(store).length,
    maxSize: MAX_STORE_SIZE,
  }
}

// 每 5 分钟清理一次过期记录（定期清理，双重保障）
// 注意：在 Next.js 中，这个定时器会在服务器进程生命周期内运行
// 进程重启时会自动清理，无需手动清理
let cleanupInterval: NodeJS.Timeout | null = null;
if (typeof setInterval !== 'undefined') {
  cleanupInterval = setInterval(cleanupExpiredRecords, 5 * 60 * 1000);
  
  // 在进程退出时清理（可选，进程退出时会自动清理）
  if (typeof process !== 'undefined' && process.on) {
    process.on('SIGTERM', () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    });
    process.on('SIGINT', () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    });
  }
}
