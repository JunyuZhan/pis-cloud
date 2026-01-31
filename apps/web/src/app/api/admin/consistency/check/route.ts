import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 数据一致性检查 API
 * POST /api/admin/consistency/check
 *
 * 请求体：
 * {
 *   autoFix: boolean,        // 是否自动修复
 *   deleteOrphanedFiles: boolean,  // 是否删除孤儿文件
 *   deleteOrphanedRecords: boolean, // 是否删除孤儿记录
 *   batchSize: number        // 每批检查数量
 * }
 *
 * 注意：此 API 通过代理调用 Worker 服务执行检查
 * 避免在 Next.js 中进行大量数据库查询导致超时
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
    interface CheckRequestBody {
      autoFix?: boolean
      deleteOrphanedFiles?: boolean
      deleteOrphanedRecords?: boolean
      batchSize?: number
    }
    let body: CheckRequestBody
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const {
      autoFix = false,
      deleteOrphanedFiles = false,
      deleteOrphanedRecords = false,
      batchSize = 100,
    } = body

    // 验证参数
    if (deleteOrphanedFiles && !autoFix) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '删除孤儿文件需要启用 autoFix' } },
        { status: 400 }
      )
    }

    if (deleteOrphanedRecords && !autoFix) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '删除孤儿记录需要启用 autoFix' } },
        { status: 400 }
      )
    }

    // 调用 Worker API 执行检查
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const workerUrl = `http://localhost:3000/api/worker/consistency/check`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }

    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          autoFix,
          deleteOrphanedFiles,
          deleteOrphanedRecords,
          batchSize,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Worker consistency check error:', response.status, errorText)
        return NextResponse.json(
          { error: { code: 'WORKER_ERROR', message: `检查失败: ${errorText}` } },
          { status: response.status }
        )
      }

      const result = await response.json()

      // 返回检查结果
      return NextResponse.json({
        success: true,
        result,
      })
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      console.error('Failed to call worker:', errorMsg)

      return NextResponse.json(
        { error: { code: 'WORKER_UNAVAILABLE', message: 'Worker 服务不可用，请稍后重试' } },
        { status: 503 }
      )
    }
  } catch {
    console.error('Consistency check API error:')
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    )
  }
}

/**
 * 获取一致性检查状态
 * GET /api/admin/consistency/check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/consistency/check',
    methods: {
      POST: {
        description: '执行数据一致性检查',
        parameters: {
          autoFix: '是否自动修复不一致的记录',
          deleteOrphanedFiles: '是否删除孤儿文件',
          deleteOrphanedRecords: '是否删除孤儿记录',
          batchSize: '每批检查的数量（默认100）',
        },
      },
    },
  })
}
