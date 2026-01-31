import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 检查并修复 pending 状态的照片（事件驱动）
 * POST /api/admin/albums/[id]/check-pending
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
    
    // 验证登录状态
    const response = NextResponse.next({ request })
    const supabase = createClientFromRequest(request, response)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }
    
    // 使用代理路由调用 Worker API
    // 代理路由会自动处理 Worker URL 配置和认证
    // 注意：内部调用使用 http://localhost:3000，避免 HTTPS 证书问题
    const proxyUrl = `http://localhost:3000/api/worker/check-pending`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 传递认证 cookie，代理路由会处理认证
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }
    
    const workerRes = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ albumId }),
    })
    
    if (!workerRes.ok) {
      const errorText = await workerRes.text()
      return NextResponse.json(
        { error: { code: 'WORKER_ERROR', message: 'Worker 服务错误', details: errorText } },
        { status: workerRes.status }
      )
    }
    
    const result = await workerRes.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Check pending error:', error)
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
