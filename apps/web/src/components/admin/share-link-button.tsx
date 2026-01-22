'use client'

import { useState } from 'react'
import { Share2, Copy, Check, ExternalLink } from 'lucide-react'

interface ShareLinkButtonProps {
  url: string
}

export function ShareLinkButton({ url }: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const handleOpen = () => {
    window.open(url, '_blank')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn-secondary"
      >
        <Share2 className="w-4 h-4" />
        分享
      </button>

      {showDropdown && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated border border-border rounded-lg shadow-lg z-50 p-4">
            <p className="text-sm text-text-secondary mb-3">分享此相册给客户：</p>
            
            <div className="flex items-center gap-2 p-2 bg-surface rounded-lg mb-3">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 bg-transparent text-sm text-text-primary outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 btn-primary text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    复制链接
                  </>
                )}
              </button>
              <button
                onClick={handleOpen}
                className="btn-secondary text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                预览
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
