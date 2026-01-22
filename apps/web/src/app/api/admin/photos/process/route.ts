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

    const { photoId, albumId, originalKey } = await request.json()

    if (!photoId || !albumId || !originalKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
        { status: 400 }
      )
    }

    // 调用内网 Worker API 触发处理
    const workerApiUrl = process.env.WORKER_API_URL || 'http://localhost:3001'
    
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
    } catch (err) {
      console.error('Failed to call worker:', err)
      // 不阻断流程
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Process API error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
