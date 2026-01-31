import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/middleware-rate-limit'

/**
 * 登录 API 路由（服务端）
 * 完全在服务端执行登录，防止客户端绕过速率限制
 * 
 * 安全措施：
 * 1. 基于 IP 的速率限制（5 次/分钟）
 * 2. 基于邮箱的速率限制（防止针对特定账户的攻击）
 * 3. 统一错误消息（不暴露具体错误原因）
 * 4. 服务端执行登录（客户端无法绕过）
 */
export async function POST(request: NextRequest) {
  try {
    // 获取客户端 IP 地址（改进的 IP 提取逻辑）
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
    
    // 优先使用 Cloudflare IP，然后是 x-forwarded-for 的第一个 IP，最后是 x-real-ip
    // 注意：NextRequest 没有 ip 属性，需要通过 headers 获取
    let ip = 'unknown'
    if (cfConnectingIp) {
      ip = cfConnectingIp
    } else if (forwardedFor) {
      // x-forwarded-for 可能包含多个 IP，取第一个（客户端真实 IP）
      ip = forwardedFor.split(',')[0].trim()
    } else if (realIp) {
      ip = realIp
    }

    // 解析请求体
    let body: { email: string; password: string; turnstileToken?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求格式错误' } },
        { status: 400 }
      )
    }

    const { email, password, turnstileToken } = body

    // 如果配置了 Turnstile，验证 token
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY
    if (turnstileSecretKey) {
      if (!turnstileToken) {
        console.warn('Turnstile configured but no token provided')
        return NextResponse.json(
          { error: { code: 'CAPTCHA_REQUIRED', message: '请完成人机验证' } },
          { status: 400 }
        )
      }

      // 验证 token
      try {
        const verifyResponse = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: turnstileSecretKey,
              response: turnstileToken,
              remoteip: ip !== 'unknown' ? ip : undefined,
            }),
          }
        )

        const verifyData = await verifyResponse.json()

        if (!verifyData.success) {
          console.error('Turnstile verification failed:', verifyData)
          console.log(JSON.stringify({
            type: 'turnstile_verification',
            success: false,
            ip,
            reason: verifyData['error-codes'] || 'unknown',
            timestamp: new Date().toISOString(),
          }))
          return NextResponse.json(
            { error: { code: 'CAPTCHA_FAILED', message: '人机验证失败，请重试' } },
            { status: 400 }
          )
        }

        // 记录成功的验证
        console.log(JSON.stringify({
          type: 'turnstile_verification',
          success: true,
          ip,
          timestamp: new Date().toISOString(),
        }))
      } catch (error) {
        console.error('Turnstile verification error:', error)
        return NextResponse.json(
          { error: { code: 'CAPTCHA_ERROR', message: '验证服务暂时不可用，请稍后重试' } },
          { status: 503 }
        )
      }
    }

    // 验证输入
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '邮箱和密码不能为空' } },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '邮箱格式不正确' } },
        { status: 400 }
      )
    }

    // 输入长度限制（防止潜在的 DoS 攻击）
    if (normalizedEmail.length > 254) { // RFC 5321 最大邮箱长度
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '邮箱长度超出限制' } },
        { status: 400 }
      )
    }

    if (password.length > 128) { // 合理的密码最大长度
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '密码长度超出限制' } },
        { status: 400 }
      )
    }

    // 双重速率限制：
    // 1. 基于 IP 的限制（防止单 IP 暴力破解）
    // 2. 基于邮箱的限制（防止针对特定账户的攻击）
    const ipRateLimit = await checkRateLimit(`login:ip:${ip}`, 5, 60 * 1000)
    const emailRateLimit = await checkRateLimit(`login:email:${normalizedEmail}`, 3, 60 * 1000)

    if (!ipRateLimit.allowed) {
      const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `登录尝试过于频繁，请 ${retryAfter} 秒后再试`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    if (!emailRateLimit.allowed) {
      const retryAfter = Math.ceil((emailRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `该账户登录尝试过于频繁，请 ${retryAfter} 秒后再试`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(emailRateLimit.resetAt).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    // 速率限制通过，执行登录
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      // 记录失败的登录尝试（用于安全审计）
      // 注意：不记录完整邮箱，只记录部分信息
      const maskedEmail = normalizedEmail.length > 3 
        ? normalizedEmail.substring(0, 3) + '***' 
        : '***'
      console.log(JSON.stringify({
        type: 'login_attempt',
        email: maskedEmail,
        ip,
        success: false,
        timestamp: new Date().toISOString(),
      }))

      // 统一错误消息，不暴露具体错误原因（防止用户枚举和信息泄露）
      // 无论是什么错误（密码错误、用户不存在、邮箱未验证等），都返回相同的消息
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_ERROR',
            message: '邮箱或密码错误',
          },
        },
        {
          status: 401,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': (ipRateLimit.remaining - 1).toString(),
            'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
          },
        }
      )
    }

    // 登录成功
    // 记录成功的登录尝试（用于安全审计）
    const maskedEmail = normalizedEmail.length > 3 
      ? normalizedEmail.substring(0, 3) + '***' 
      : '***'
    console.log(JSON.stringify({
      type: 'login_attempt',
      email: maskedEmail,
      ip,
      success: true,
      timestamp: new Date().toISOString(),
    }))

    // 会话 cookies 已由 Supabase 自动设置
    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': ipRateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
        },
      }
    )
  } catch (error) {
    console.error('Login API error:', error)
    // 统一错误消息，不暴露内部错误
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '登录失败，请重试' } },
      { status: 500 }
    )
  }
}
