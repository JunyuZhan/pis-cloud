/**
 * 简单的内存速率限制工具
 * 生产环境建议使用 Redis 或专业的速率限制中间件
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const store: RateLimitStore = {}

/**
 * 速率限制检查
 * @param identifier 标识符（如 IP 地址或用户 ID）
 * @param maxRequests 最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns 是否允许请求
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const record = store[key]

  // 如果记录不存在或已过期，创建新记录
  if (!record || now > record.resetAt) {
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
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
 * 清理过期的记录（定期调用）
 */
export function cleanupExpiredRecords() {
  const now = Date.now()
  Object.keys(store).forEach((key) => {
    if (now > store[key].resetAt) {
      delete store[key]
    }
  })
}

// 每 5 分钟清理一次过期记录
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRecords, 5 * 60 * 1000)
}
