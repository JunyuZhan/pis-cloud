'use client'

import { useEffect, useState } from 'react'
import { Turnstile } from '@/components/auth/turnstile'

/**
 * Turnstile 测试页面
 * 用于验证 Turnstile 是否正常工作
 * 访问: http://localhost:3000/test-turnstile
 */
export default function TestTurnstilePage() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadTime, setLoadTime] = useState<number>(0)

  const hasTurnstile = typeof window !== 'undefined' && 
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    const startTime = Date.now()
    const timer = setInterval(() => {
      setLoadTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full card p-6">
        <h1 className="text-2xl font-bold mb-4">Turnstile 测试页面</h1>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">配置状态：</p>
            <div className="p-3 bg-surface-elevated rounded-lg">
              {hasTurnstile ? (
                <div className="text-green-400">
                  ✅ Turnstile 已配置
                  <br />
                  <span className="text-xs text-text-muted">
                    Site Key: {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.substring(0, 20)}...
                  </span>
                </div>
              ) : (
                <div className="text-yellow-400">
                  ⚠️ Turnstile 未配置
                  <br />
                  <span className="text-xs text-text-muted">
                    请在 .env 中配置 NEXT_PUBLIC_TURNSTILE_SITE_KEY
                  </span>
                </div>
              )}
            </div>
          </div>

          {hasTurnstile && (
            <>
              <div className="hidden">
                <Turnstile
                  onVerify={(token) => {
                    setToken(token)
                    setError(null)
                  }}
                  onError={() => {
                    setError('Turnstile 验证失败')
                  }}
                  onExpire={() => {
                    setToken(null)
                  }}
                />
              </div>

              <div>
                <p className="text-sm text-text-secondary mb-2">验证状态：</p>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  {token ? (
                    <div className="text-green-400">
                      ✅ Turnstile 验证成功！
                      <br />
                      <span className="text-xs text-text-muted break-all">
                        Token: {token.substring(0, 30)}...
                      </span>
                    </div>
                  ) : error ? (
                    <div className="text-red-400">
                      ❌ {error}
                      <br />
                      <span className="text-xs text-text-muted mt-2 block">
                        可能的原因：
                        <br />• localhost 未添加到 Cloudflare 主机名列表
                        <br />• 网络问题导致无法连接 Cloudflare
                        <br />• 检查浏览器控制台是否有错误信息
                      </span>
                    </div>
                  ) : (
                    <div className="text-yellow-400">
                      ⏳ 等待验证... ({loadTime}秒)
                      <br />
                      <span className="text-xs text-text-muted">
                        页面加载时 Turnstile 会自动验证
                        {loadTime > 5 && (
                          <>
                            <br />
                            <br />
                            <span className="text-red-400">
                              ⚠️ 等待超过 5 秒，可能有问题：
                              <br />• 检查浏览器控制台（F12）是否有错误
                              <br />• 确认 localhost 已添加到 Cloudflare 主机名列表
                              <br />• 尝试刷新页面
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-text-secondary mb-2">故障排除：</p>
                <div className="text-xs text-text-muted space-y-2">
                  <div>
                    <strong>如果一直显示&ldquo;等待验证&rdquo;：</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li>打开浏览器开发者工具（F12）→ Console，查看是否有错误</li>
                      <li>打开 Network 标签，搜索 &ldquo;turnstile&rdquo;，确认请求是否成功</li>
                      <li>检查 Cloudflare Dashboard → Turnstile → 主机名管理，确认已添加 localhost</li>
                      <li>尝试刷新页面（Cmd+R 或 Ctrl+R）</li>
                    </ul>
                  </div>
                  <div>
                    <strong>如何添加 localhost 到主机名：</strong>
                    <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                      <li>访问 Cloudflare Dashboard → Turnstile</li>
                      <li>点击你的站点（&ldquo;人机验证&rdquo;）</li>
                      <li>在&ldquo;主机名管理&rdquo;部分，点击&ldquo;搜索…&rdquo;</li>
                      <li>输入 &ldquo;localhost&rdquo; 并添加</li>
                      <li>保存后刷新此页面</li>
                    </ol>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
