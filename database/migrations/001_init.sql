-- ============================================
-- PIS 数据库初始化迁移
-- 版本: 001_init
-- 日期: 2026-01-22
-- 作者: Claude
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 相册表 (albums)
-- ============================================
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug UUID UNIQUE DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_id UUID,
  
  -- 显示设置
  is_public BOOLEAN DEFAULT false,
  layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
  sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
  allow_download BOOLEAN DEFAULT false,
  show_exif BOOLEAN DEFAULT true,
  
  -- 水印配置
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- 元数据
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 照片表 (photos)
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  
  -- 存储路径
  original_key TEXT NOT NULL,
  preview_key TEXT,
  thumb_key TEXT,
  
  -- 图片信息
  filename TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  blur_data TEXT, -- BlurHash 字符串
  
  -- EXIF 数据
  exif JSONB DEFAULT '{}',
  captured_at TIMESTAMPTZ,
  
  -- 处理状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- 交互状态
  is_selected BOOLEAN DEFAULT false,
  
  -- 排序
  sort_order INTEGER DEFAULT 0,
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX idx_albums_slug ON albums(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_is_public ON albums(is_public) WHERE deleted_at IS NULL;
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX idx_photos_status ON photos(status);

-- ============================================
-- 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 照片计数函数
-- ============================================
CREATE OR REPLACE FUNCTION increment_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums
  SET photo_count = photo_count + 1
  WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums
  SET photo_count = GREATEST(photo_count - 1, 0)
  WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 策略：所有未删除相册可通过 slug 访问 (分享链接)
-- PRD 2.3: /album/[slug] 通过唯一链接访问，无视 is_public 状态
CREATE POLICY "Albums are viewable by slug" 
ON albums FOR SELECT 
TO anon, authenticated
USING (deleted_at IS NULL);

-- 策略：照片随相册可见性 (相册未删除即可访问)
CREATE POLICY "Photos are viewable if album exists"
ON photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM albums 
    WHERE albums.id = photos.album_id 
    AND albums.deleted_at IS NULL
  )
);

-- 策略：管理员拥有所有权限
-- 注意: 这里的 authenticated 指的是 Supabase Auth 登录用户 (管理员)
-- 实际项目中建议配合 Custom Claims 或特定的 email 校验
CREATE POLICY "Admins can do everything on albums"
ON albums FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can do everything on photos"
ON photos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 匿名用户可以更新 is_selected 状态 (选片功能)
CREATE POLICY "Public can select photos"
  ON photos
  FOR UPDATE
  TO anon
  USING (status = 'completed')
  WITH CHECK (status = 'completed');

-- ============================================
-- 启用 Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
