import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 触发照片处理
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证登录状态
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 解析请求体
    interface ProcessRequestBody {
      photoId: string
      albumId: string
      originalKey: string
    }
    let body: ProcessRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { photoId, albumId, originalKey } = body

    if (!photoId || !albumId || !originalKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
        { status: 400 }
      )
    }

    // 使用代理路由调用 Worker API 触发处理
    // 代理路由会自动处理 Worker URL 配置和认证
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const proxyUrl = `http://localhost:3000/api/worker/process`

    let workerAvailable = true
    let workerError: string | null = null

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // 传递认证 cookie，代理路由会处理认证
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        headers['cookie'] = cookieHeader
      }

      const processRes = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ photoId, albumId, originalKey }),
      })

      if (!processRes.ok) {
        const errorText = await processRes.text()
        console.error('Worker process error:', processRes.status, errorText)
        workerAvailable = false
        workerError = `Worker 返回错误: ${processRes.status}`
      }
    } catch (err) {
      console.error('Failed to call worker:', err)
      workerAvailable = false
      workerError = err instanceof Error ? err.message : '无法连接到 Worker 服务'
    }

    // 如果 Worker 不可用，返回警告状态码
    if (!workerAvailable) {
      return NextResponse.json(
        {
          success: true,
          warning: {
            code: 'WORKER_UNAVAILABLE',
            message: '照片处理服务暂时不可用，照片将在后台异步处理',
            details: workerError,
          },
        },
        { status: 202 } // 202 Accepted: 请求已接受，但处理尚未完成
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    console.error('Process API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
