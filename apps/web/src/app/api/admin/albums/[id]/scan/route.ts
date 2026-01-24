import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Worker 服务 URL
const WORKER_URL = process.env.WORKER_URL || 
                   process.env.WORKER_API_URL || 
                   process.env.NEXT_PUBLIC_WORKER_URL || 
                   'http://localhost:3001'

/**
 * 触发扫描同步
 * POST /api/admin/albums/{id}/scan
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: albumId } = await params
    const supabase = await createClient()

    // 验证登录状态
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 验证相册存在
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, title')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    // 调用 Worker 扫描 API
    const workerResponse = await fetch(`${WORKER_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    })

    if (!workerResponse.ok) {
      const error = await workerResponse.json()
      return NextResponse.json(
        { error: { code: 'WORKER_ERROR', message: error.error || 'Worker 服务错误' } },
        { status: 500 }
      )
    }

    const result = await workerResponse.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Scan API error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}
