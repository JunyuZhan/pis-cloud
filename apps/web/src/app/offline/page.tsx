'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-surface-elevated rounded-full flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-text-muted" />
        </div>
        
        <h1 className="text-2xl font-serif font-bold mb-3">
          您目前处于离线状态
        </h1>
        
        <p className="text-text-secondary mb-6">
          请检查您的网络连接后重试。已浏览的照片仍然可以离线查看。
        </p>
        
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          <RefreshCw className="w-4 h-4" />
          重新加载
        </button>
      </div>
    </main>
  )
}
