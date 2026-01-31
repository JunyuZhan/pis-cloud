import { NextResponse } from 'next/server'

/**
 * 健康检查端点（根路径）
 * GET /health
 * 
 * 用于 Docker 健康检查和负载均衡器探测
 * 注意：此路由不在 [locale] 下，避免 i18n 重定向
 */
export async function GET() {
  return NextResponse.json(
    { 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'pis-web'
    },
    { status: 200 }
  )
}

export const dynamic = 'force-dynamic'
