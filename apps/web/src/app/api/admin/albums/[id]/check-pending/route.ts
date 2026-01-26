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
    
    // 调用 Worker API
    const workerApiUrl = process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const workerApiKey = process.env.WORKER_API_KEY
    if (workerApiKey) {
      headers['X-API-Key'] = workerApiKey
    }
    
    const workerRes = await fetch(`${workerApiUrl}/api/check-pending`, {
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
