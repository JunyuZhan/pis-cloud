import { NextResponse } from 'next/server'

/**
 * 健康检查端点
 * GET /api/health
 * 
 * 用于 Docker 健康检查和负载均衡器探测
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

// 同时支持 /health 路径（Nginx 配置使用）
export const dynamic = 'force-dynamic'
