-- PIS 完整数据库架构
-- 使用方法:
-- 1. 在 Supabase Dashboard -> SQL Editor 中执行此文件
-- 2. 或使用 psql: psql $DATABASE_URL < database/full_schema.sql
--
-- ⚠️ 重要提示：
--   - 此文件仅适用于全新的数据库（首次安装）
--   - 只需执行一次即可完成所有数据库初始化
--   - 不要在已有数据的数据库上重复执行

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 相册表
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
  allow_share BOOLEAN DEFAULT true,
  
  -- 水印配置
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- 高级功能
  password TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  allow_batch_download BOOLEAN DEFAULT true,
  selected_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_live BOOLEAN DEFAULT false,
  
  -- 分享配置
  share_title TEXT,
  share_description TEXT,
  share_image_url TEXT,
  poster_image_url TEXT,
  
  -- 活动元数据
  event_date TIMESTAMPTZ,
  location TEXT,
  
  -- 元数据
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 照片表
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
  blur_data TEXT,
  
  -- EXIF 数据
  exif JSONB DEFAULT '{}',
  captured_at TIMESTAMPTZ,
  
  -- 处理状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- 交互状态
  is_selected BOOLEAN DEFAULT false,
  rotation INTEGER DEFAULT NULL CHECK (rotation IS NULL OR rotation IN (0, 90, 180, 270)),
  
  -- 排序
  sort_order INTEGER DEFAULT 0,
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 相册模板表
CREATE TABLE album_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- 模板配置
  is_public BOOLEAN DEFAULT false,
  layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
  sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
  allow_download BOOLEAN DEFAULT false,
  allow_batch_download BOOLEAN DEFAULT true,
  show_exif BOOLEAN DEFAULT true,
  
  -- 访问控制
  password TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  
  -- 水印设置
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 打包下载任务表
CREATE TABLE package_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  
  -- 打包配置
  photo_ids UUID[] NOT NULL,
  include_watermarked BOOLEAN DEFAULT true,
  include_original BOOLEAN DEFAULT true,
  
  -- 打包状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- 存储信息
  zip_key TEXT,
  file_size BIGINT,
  
  -- 下载链接
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 照片分组表
CREATE TABLE photo_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_group_name_per_album UNIQUE (album_id, name)
);

-- 照片分组关联表
CREATE TABLE photo_group_assignments (
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, group_id)
);

-- 索引
CREATE INDEX idx_albums_slug ON albums(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_is_public ON albums(is_public) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_expires_at ON albums(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_albums_password ON albums(password) WHERE password IS NOT NULL;
CREATE INDEX idx_albums_event_date ON albums(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_album_status_captured ON photos(album_id, status, captured_at DESC) WHERE status = 'completed';
CREATE INDEX idx_photos_album_status_created ON photos(album_id, status, created_at DESC) WHERE status = 'completed';
CREATE INDEX idx_photos_album_status_sort ON photos(album_id, status, sort_order ASC) WHERE status = 'completed';
CREATE INDEX idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_photos_album_deleted ON photos(album_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_album_templates_name ON album_templates(name);
CREATE INDEX idx_album_templates_created_at ON album_templates(created_at DESC);
CREATE INDEX idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX idx_package_downloads_status ON package_downloads(status);
CREATE INDEX idx_package_downloads_expires_at ON package_downloads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);
CREATE INDEX idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);
CREATE INDEX idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);

-- 更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER albums_updated_at BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER photos_updated_at BEFORE UPDATE ON photos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER album_templates_updated_at BEFORE UPDATE ON album_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER package_downloads_updated_at BEFORE UPDATE ON package_downloads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 照片计数函数（排除已删除的照片）
CREATE OR REPLACE FUNCTION increment_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  -- 注意：此函数在 Worker 处理完成后调用，此时照片状态已经是 completed
  -- 但为了安全，我们重新统计，确保只统计未删除的 completed 照片
  UPDATE albums 
  SET photo_count = (
    SELECT COUNT(*) FROM photos 
    WHERE photos.album_id = albums.id 
    AND photos.status = 'completed' 
    AND photos.deleted_at IS NULL
  )
  WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- 选片数量更新函数
CREATE OR REPLACE FUNCTION update_album_selected_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_selected IS DISTINCT FROM NEW.is_selected THEN
    UPDATE albums
    SET selected_count = (
      SELECT COUNT(*) FROM photos 
      WHERE album_id = NEW.album_id AND is_selected = true AND status = 'completed'
    )
    WHERE id = NEW.album_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_selected_count
AFTER UPDATE OF is_selected ON photos
FOR EACH ROW
EXECUTE FUNCTION update_album_selected_count();

-- 照片分组更新时间触发器函数
CREATE OR REPLACE FUNCTION update_photo_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_photo_groups_updated_at
BEFORE UPDATE ON photo_groups
FOR EACH ROW
EXECUTE FUNCTION update_photo_groups_updated_at();

-- 浏览量统计函数
CREATE OR REPLACE FUNCTION increment_album_view_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums SET view_count = view_count + 1 WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- 初始化选片数量
UPDATE albums SET selected_count = (
  SELECT COUNT(*) FROM photos 
  WHERE photos.album_id = albums.id AND is_selected = true AND status = 'completed'
);

-- 启用 RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_group_assignments ENABLE ROW LEVEL SECURITY;

-- RLS 策略：相册可通过 slug 访问
CREATE POLICY "Albums are viewable by slug" 
ON albums FOR SELECT 
TO anon, authenticated
USING (deleted_at IS NULL);

-- RLS 策略：照片随相册可见性
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

-- RLS 策略：管理员拥有所有权限
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

CREATE POLICY "Admins can manage templates"
ON album_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage package downloads"
ON package_downloads FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "管理员可以管理所有分组"
ON photo_groups FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "管理员可以管理所有分组关联"
ON photo_group_assignments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS 策略：匿名用户可以查看已完成的打包
CREATE POLICY "Public can view completed packages"
ON package_downloads FOR SELECT
TO anon, authenticated
USING (status = 'completed' AND expires_at > NOW());

-- RLS 策略：访客可以查看公开相册的分组
CREATE POLICY "访客可以查看公开相册的分组"
ON photo_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM albums
    WHERE albums.id = photo_groups.album_id
    AND albums.is_public = true
    AND albums.deleted_at IS NULL
    AND (albums.expires_at IS NULL OR albums.expires_at > NOW())
  )
);

CREATE POLICY "访客可以查看公开相册的分组关联"
ON photo_group_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM photos
    JOIN albums ON albums.id = photos.album_id
    WHERE photos.id = photo_group_assignments.photo_id
    AND albums.is_public = true
    AND albums.deleted_at IS NULL
    AND (albums.expires_at IS NULL OR albums.expires_at > NOW())
    AND photos.status = 'completed'
  )
);

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
