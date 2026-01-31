/**
 * 图片预加载工具
 * 优化图片加载性能，预加载即将可见的图片
 */

interface PreloadOptions {
  priority?: 'high' | 'low'
  fetchPriority?: 'high' | 'low' | 'auto'
}

/**
 * 预加载单张图片
 */
export function preloadImage(src: string, options: PreloadOptions = {}): void {
  if (!src) return
  
  // 检查是否已经预加载过
  if (document.querySelector(`link[href="${src}"]`)) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  
  // 设置优先级（如果支持）
  if (options.fetchPriority) {
    link.setAttribute('fetchpriority', options.fetchPriority)
  }
  
  document.head.appendChild(link)
}

/**
 * 批量预加载图片
 */
export function preloadImages(srcs: string[], options: PreloadOptions = {}): void {
  srcs.forEach((src, index) => {
    // 前几张图片使用高优先级
    const priority = index < 3 ? 'high' : 'low'
    preloadImage(src, { ...options, fetchPriority: priority as 'high' | 'low' })
  })
}

/**
 * 预加载即将可见的图片（基于 Intersection Observer）
 */
export function preloadVisibleImages(
  container: HTMLElement,
  imageSelector: string,
  options: { preloadCount?: number } = {}
): () => void {
  const { preloadCount = 3 } = options
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.getAttribute('data-preload-src') || img.src
          
          if (src) {
            // 预加载当前图片和后续几张
            const container = img.closest('[data-image-container]')
            if (container) {
              const images = Array.from(
                container.querySelectorAll<HTMLImageElement>(imageSelector)
              )
              const currentIndex = images.indexOf(img)
              
              for (let i = 1; i <= preloadCount && currentIndex + i < images.length; i++) {
                const nextImg = images[currentIndex + i]
                const nextSrc = nextImg.getAttribute('data-preload-src') || nextImg.src
                if (nextSrc) {
                  preloadImage(nextSrc, { fetchPriority: i === 1 ? 'high' : 'low' })
                }
              }
            }
          }
          
          observer.unobserve(img)
        }
      })
    },
    { rootMargin: '200px' } // 提前 200px 开始预加载
  )
  
  const images = container.querySelectorAll<HTMLImageElement>(imageSelector)
  images.forEach((img) => observer.observe(img))
  
  // 返回清理函数
  return () => observer.disconnect()
}
