'use client'

import { useState } from 'react'
import { Share2, Copy, Check, ExternalLink, QrCode, Download } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface ShareLinkButtonProps {
  url: string
  albumTitle?: string
}

export function ShareLinkButton({ url, albumTitle = '相册' }: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQR, setShowQR] = useState(false)

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

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `${albumTitle}-二维码.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn-primary text-sm"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">分享相册</span>
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
            {/* 标签切换 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowQR(false)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  !showQR ? 'bg-accent text-background' : 'bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                链接分享
              </button>
              <button
                onClick={() => setShowQR(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                  showQR ? 'bg-accent text-background' : 'bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                <QrCode className="w-4 h-4" />
                二维码
              </button>
            </div>

            {!showQR ? (
              <>
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
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary mb-3 text-center">扫描二维码访问相册</p>
                
                {/* 二维码 */}
                <div className="flex justify-center p-4 bg-white rounded-lg mb-3">
                  <QRCodeSVG
                    id="qr-code-svg"
                    value={url}
                    size={180}
                    level="H"
                    includeMargin
                    imageSettings={{
                      src: '/logo.png',
                      height: 30,
                      width: 30,
                      excavate: true,
                    }}
                  />
                </div>

                <button
                  onClick={handleDownloadQR}
                  className="w-full btn-primary text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载二维码
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
