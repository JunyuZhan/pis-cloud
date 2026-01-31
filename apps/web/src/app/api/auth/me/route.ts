import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

/**
 * 获取当前用户信息 API
 * 用于客户端检查登录状态
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('pis-auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ user: null })
    }

    const secret = new TextEncoder().encode(
      process.env.AUTH_JWT_SECRET || process.env.ALBUM_SESSION_SECRET || 'fallback-secret'
    )

    try {
      const { payload } = await jwtVerify(authToken, secret, {
        issuer: 'pis-auth',
        audience: 'pis-app',
      })

      return NextResponse.json({
        user: {
          id: payload.sub,
          email: payload.email,
        },
      })
    } catch {
      // Token 无效
      return NextResponse.json({ user: null })
    }
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json({ user: null })
  }
}
