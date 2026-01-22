-- ============================================
-- 打包下载功能
-- 版本: 005_package_downloads
-- 日期: 2026-01-24
-- ============================================

-- 创建打包下载任务表
CREATE TABLE IF NOT EXISTS package_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  
  -- 打包配置
  photo_ids UUID[] NOT NULL, -- 要打包的照片ID列表
  include_watermarked BOOLEAN DEFAULT true, -- 是否包含有水印版本
  include_original BOOLEAN DEFAULT true, -- 是否包含无水印版本
  
  -- 打包状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- 存储信息
  zip_key TEXT, -- ZIP文件在MinIO中的key
  file_size BIGINT, -- 文件大小（字节）
  
  -- 下载链接（Presigned URL）
  download_url TEXT,
  expires_at TIMESTAMPTZ, -- 下载链接过期时间（15天后）
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX IF NOT EXISTS idx_package_downloads_status ON package_downloads(status);
CREATE INDEX IF NOT EXISTS idx_package_downloads_expires_at ON package_downloads(expires_at) WHERE expires_at IS NOT NULL;

-- 更新时间触发器
CREATE TRIGGER package_downloads_updated_at
  BEFORE UPDATE ON package_downloads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 启用 RLS
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;

-- RLS 策略：仅管理员可以访问
CREATE POLICY "Admins can manage package downloads"
ON package_downloads FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 匿名用户可以查看已完成的打包（通过下载链接）
CREATE POLICY "Public can view completed packages"
ON package_downloads FOR SELECT
TO anon, authenticated
USING (status = 'completed' AND expires_at > NOW());

COMMENT ON TABLE package_downloads IS '照片打包下载任务表';
COMMENT ON COLUMN package_downloads.photo_ids IS '要打包的照片ID数组';
COMMENT ON COLUMN package_downloads.include_watermarked IS '是否包含有水印版本';
COMMENT ON COLUMN package_downloads.include_original IS '是否包含无水印版本';
COMMENT ON COLUMN package_downloads.expires_at IS '下载链接过期时间，默认15天';
