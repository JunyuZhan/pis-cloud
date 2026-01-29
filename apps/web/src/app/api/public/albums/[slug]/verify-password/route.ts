import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/middleware-rate-limit'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 验证相册密码 API
 * POST /api/public/albums/[slug]/verify-password
 *
 * 安全措施：
 * 1. 基于 IP 的速率限制（防止暴力破解）
 * 2. 基于相册的速率限制（防止针对特定相册的攻击）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    
    // 获取客户端 IP 地址（与登录API使用相同的IP提取逻辑）
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
    
    let ip = 'unknown'
    if (cfConnectingIp) {
      ip = cfConnectingIp
    } else if (forwardedFor) {
      // x-forwarded-for 可能包含多个 IP，取第一个（客户端真实 IP）
      ip = forwardedFor.split(',')[0].trim()
    } else if (realIp) {
      ip = realIp
    }
    
    // 检测是否是内网 IP（内网部署时，所有请求可能来自同一个 IP）
    const isPrivateIP = (ipAddr: string): boolean => {
      if (ipAddr === 'unknown' || ipAddr === 'localhost' || ipAddr === '127.0.0.1') {
        return true
      }
      // 内网 IP 段：10.x.x.x, 172.16.x.x-172.31.x.x, 192.168.x.x
      const privateIPPatterns = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
      ]
      return privateIPPatterns.some(pattern => pattern.test(ipAddr))
    }
    
    const isInternalNetwork = isPrivateIP(ip)
    
    // 双重速率限制：
    // 1. 基于 IP 的限制（防止单 IP 暴力破解）
    //    - 公网 IP：每分钟最多 10 次
    //    - 内网 IP：每分钟最多 30 次（内网部署时，多个用户可能共享同一 IP）
    //    - unknown IP：跳过 IP 限制（主要依赖相册限制）
    // 2. 基于相册的限制（防止针对特定相册的攻击）：每分钟最多 5 次
    const ipLimit = isInternalNetwork ? 30 : (ip === 'unknown' ? 0 : 10)
    const albumRateLimit = await checkRateLimit(`verify-password:album:${slug}`, 5, 60 * 1000)
    
    // 只有在有有效 IP 且不是内网 IP 时，才进行严格的 IP 限制
    // 内网部署时主要依赖基于相册的限制
    if (ipLimit > 0) {
      const ipRateLimit = await checkRateLimit(`verify-password:ip:${ip}`, ipLimit, 60 * 1000)
      
      if (!ipRateLimit.allowed) {
        const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `密码验证尝试过于频繁，请 ${retryAfter} 秒后再试`,
            },
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': ipLimit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }
    }
    
    if (!albumRateLimit.allowed) {
      const retryAfter = Math.ceil((albumRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `该相册密码验证尝试过于频繁，请 ${retryAfter} 秒后再试`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(albumRateLimit.resetAt).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }
    
    // 解析请求体
    interface VerifyPasswordRequestBody {
      password: string
    }
    let body: VerifyPasswordRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请提供密码' } },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 获取相册信息（包含密码）
    const { data: album, error } = await supabase
      .from('albums')
      .select('id, password, expires_at, deleted_at')
      .eq('slug', slug)
      .single()

    if (error || !album || album.deleted_at) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 检查相册是否过期
    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'EXPIRED', message: '相册已过期' } },
        { status: 403 }
      )
    }

    // 如果没有设置密码，直接通过
    if (!album.password) {
      return NextResponse.json({ verified: true })
    }

    // 验证密码（明文比较）
    // 注意：相册密码是简单的访问控制，不需要复杂的哈希加密
    const passwordVerified = album.password === password

    if (passwordVerified) {
      return NextResponse.json({ verified: true })
    } else {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: '密码错误' } },
        { status: 401 }
      )
    }
  } catch {
    console.error('Verify password API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
