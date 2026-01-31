/**
 * 相册配置缓存
 * 减少数据库查询，提升性能
 */

interface CachedAlbum {
  id: string;
  watermark_enabled: boolean;
  watermark_type: string | null;
  watermark_config: any;
  color_grading?: { preset?: string } | null;
  cachedAt: number;
}

class AlbumCache {
  private cache: Map<string, CachedAlbum> = new Map();
  private ttl: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 300000) {
    this.ttl = ttlMs;
    
    // 定期清理过期缓存（每5分钟）
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 清理定时器（用于优雅退出）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  get(albumId: string): CachedAlbum | null {
    const cached = this.cache.get(albumId);
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.cachedAt > this.ttl) {
      this.cache.delete(albumId);
      return null;
    }

    return cached;
  }

  set(albumId: string, album: Omit<CachedAlbum, 'cachedAt'>): void {
    this.cache.set(albumId, {
      ...album,
      cachedAt: Date.now(),
    });
  }

  delete(albumId: string): void {
    this.cache.delete(albumId);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [albumId, cached] of this.cache.entries()) {
      if (now - cached.cachedAt > this.ttl) {
        this.cache.delete(albumId);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// 单例缓存实例
let albumCacheInstance: AlbumCache | null = null;

export function getAlbumCache(): AlbumCache {
  if (!albumCacheInstance) {
    const ttl = parseInt(process.env.ALBUM_CACHE_TTL_MS || '300000');
    albumCacheInstance = new AlbumCache(ttl);
  }
  return albumCacheInstance;
}

export function clearAlbumCache(): void {
  if (albumCacheInstance) {
    albumCacheInstance.clear();
  }
}

/**
 * 销毁缓存实例（用于优雅退出）
 */
export function destroyAlbumCache(): void {
  if (albumCacheInstance) {
    albumCacheInstance.destroy();
    albumCacheInstance = null;
  }
}
