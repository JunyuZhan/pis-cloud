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

    // 调用远程 Worker API 触发处理
    const workerApiUrl = process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    
    try {
      const processRes = await fetch(`${workerApiUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, albumId, originalKey }),
      })

      if (!processRes.ok) {
        console.error('Worker process error:', await processRes.text())
        // 不阻断流程，Worker 可以通过定时任务补偿
      }
    } catch {
      console.error('Failed to call worker:')
      // 不阻断流程
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
