-- PIS 完整数据库架构
-- 自动生成于 2026-01-25 00:21:53
-- 包含所有迁移文件的合并内容

-- ================================================
-- 使用方法:
-- 1. 在 Supabase Dashboard -> SQL Editor 中执行此文件
-- 2. 或使用 psql: psql $DATABASE_URL < database/full_schema.sql
-- ================================================


-- ================================================
-- 迁移: 001_init.sql
-- ================================================

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


-- ================================================
-- 迁移: 002_secure_rls.sql
-- ================================================

-- ============================================
-- 修复 RLS 安全漏洞
-- 版本: 002_secure_rls
-- 日期: 2026-01-23
-- ============================================

-- 1. 撤销匿名用户的 UPDATE 权限
-- 原策略 "Public can select photos" 过于宽泛，允许修改所有字段
DROP POLICY IF EXISTS "Public can select photos" ON photos;

-- 2. 确认仅管理员可 UPDATE
-- 现有的 "Admins can do everything on photos" 策略已经覆盖了这一点
-- 只有 authenticated 用户（管理员）或 Service Role 可以修改数据


-- ================================================
-- 迁移: 003_album_features.sql
-- ================================================

-- 003_album_features.sql
-- 添加相册高级功能字段

-- 添加密码保护字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS password TEXT DEFAULT NULL;

-- 添加到期时间字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- 添加批量下载开关
ALTER TABLE albums ADD COLUMN IF NOT EXISTS allow_batch_download BOOLEAN DEFAULT true;

-- 添加选片数量统计
ALTER TABLE albums ADD COLUMN IF NOT EXISTS selected_count INTEGER DEFAULT 0;

-- 添加浏览量统计
ALTER TABLE albums ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 创建更新选片数量的触发器函数
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

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_selected_count ON photos;
CREATE TRIGGER trigger_update_selected_count
AFTER UPDATE OF is_selected ON photos
FOR EACH ROW
EXECUTE FUNCTION update_album_selected_count();

-- 初始化已有相册的选片数量
UPDATE albums SET selected_count = (
  SELECT COUNT(*) FROM photos 
  WHERE photos.album_id = albums.id AND is_selected = true AND status = 'completed'
);

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_albums_expires_at ON albums(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_password ON albums(password) WHERE password IS NOT NULL;

COMMENT ON COLUMN albums.password IS '相册访问密码，NULL 表示无密码';
COMMENT ON COLUMN albums.expires_at IS '相册到期时间，NULL 表示永不过期';
COMMENT ON COLUMN albums.allow_batch_download IS '是否允许批量下载已选照片';
COMMENT ON COLUMN albums.selected_count IS '客户选片数量';
COMMENT ON COLUMN albums.view_count IS '相册浏览次数';


-- ================================================
-- 迁移: 004_album_templates.sql
-- ================================================

-- ============================================
-- 相册模板功能
-- 版本: 004_album_templates
-- 日期: 2026-01-24
-- ============================================

-- 创建相册模板表
CREATE TABLE IF NOT EXISTS album_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- 模板配置（复制自相册设置）
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_album_templates_name ON album_templates(name);
CREATE INDEX IF NOT EXISTS idx_album_templates_created_at ON album_templates(created_at DESC);

-- 更新时间触发器
CREATE TRIGGER album_templates_updated_at
  BEFORE UPDATE ON album_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 启用 RLS
ALTER TABLE album_templates ENABLE ROW LEVEL SECURITY;

-- RLS 策略：仅管理员可以访问模板
CREATE POLICY "Admins can manage templates"
ON album_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE album_templates IS '相册模板表，用于保存和复用相册配置';
COMMENT ON COLUMN album_templates.name IS '模板名称';
COMMENT ON COLUMN album_templates.description IS '模板描述';


-- ================================================
-- 迁移: 005_package_downloads.sql
-- ================================================

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


-- ================================================
-- 迁移: 006_album_share_config.sql
-- ================================================

-- ============================================
-- 相册分享配置
-- 版本: 006_album_share_config
-- 日期: 2026-01-24
-- ============================================

-- 添加分享配置字段到相册表
ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_title TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_description TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_image_url TEXT;

COMMENT ON COLUMN albums.share_title IS '分享卡片标题（用于微信/Open Graph）';
COMMENT ON COLUMN albums.share_description IS '分享卡片描述（用于微信/Open Graph）';
COMMENT ON COLUMN albums.share_image_url IS '分享卡片图片URL（用于微信/Open Graph）';


-- ================================================
-- 迁移: 007_photo_groups.sql
-- ================================================

-- ============================================
-- 相册分组功能
-- 版本: 007_photo_groups
-- 日期: 2026-01-24
-- ============================================

-- 创建照片分组表
CREATE TABLE IF NOT EXISTS photo_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 确保同一相册内分组名称唯一
  CONSTRAINT unique_group_name_per_album UNIQUE (album_id, name)
);

-- 创建照片分组关联表
CREATE TABLE IF NOT EXISTS photo_group_assignments (
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, group_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);

-- 创建更新时间触发器
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

-- 启用 RLS
ALTER TABLE photo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_group_assignments ENABLE ROW LEVEL SECURITY;

-- RLS 策略：管理员可以管理所有分组
-- 注意：当前系统使用 authenticated 角色管理权限，所有认证用户都是管理员
CREATE POLICY "管理员可以管理所有分组"
  ON photo_groups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS 策略：管理员可以管理所有分组关联
CREATE POLICY "管理员可以管理所有分组关联"
  ON photo_group_assignments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS 策略：访客可以查看公开相册的分组
CREATE POLICY "访客可以查看公开相册的分组"
  ON photo_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = photo_groups.album_id
      AND albums.is_public = true
      AND albums.deleted_at IS NULL
      AND (albums.expires_at IS NULL OR albums.expires_at > NOW())
    )
  );

-- RLS 策略：访客可以查看公开相册的分组关联
CREATE POLICY "访客可以查看公开相册的分组关联"
  ON photo_group_assignments
  FOR SELECT
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

-- 添加注释
COMMENT ON TABLE photo_groups IS '照片分组表，用于将相册中的照片按活动流程或日期分组';
COMMENT ON TABLE photo_group_assignments IS '照片分组关联表，记录照片所属的分组';
COMMENT ON COLUMN photo_groups.name IS '分组名称，如：签到、会议、颁奖、晚宴等';
COMMENT ON COLUMN photo_groups.sort_order IS '排序顺序，数字越小越靠前';
COMMENT ON COLUMN photo_group_assignments.photo_id IS '照片ID';
COMMENT ON COLUMN photo_group_assignments.group_id IS '分组ID';


-- ================================================
-- 迁移: 008_album_event_metadata.sql
-- ================================================

-- ============================================
-- 相册活动元数据
-- 版本: 008_album_event_metadata
-- 日期: 2026-01-24
-- ============================================

-- 添加活动时间字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;

-- 添加活动地点字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS location TEXT;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_albums_event_date ON albums(event_date) WHERE event_date IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN albums.event_date IS '活动时间（实际活动日期，区别于相册创建时间）';
COMMENT ON COLUMN albums.location IS '活动地点';


-- ================================================
-- 迁移: 009_increment_view_count.sql
-- ================================================

-- 009_increment_view_count.sql
-- 添加增加相册浏览次数的函数

-- 创建增加浏览次数的函数（原子操作）
CREATE OR REPLACE FUNCTION increment_album_view_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums
  SET view_count = view_count + 1
  WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_album_view_count(UUID) IS '原子性地增加相册浏览次数';


-- ================================================
-- 迁移: 010_album_live_mode.sql
-- ================================================

-- ============================================
-- PIS 数据库迁移: 相册直播模式
-- 版本: 010
-- 描述: 添加相册直播模式开关
-- ============================================

-- 添加 is_live 字段到 albums 表
ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- 添加注释
COMMENT ON COLUMN albums.is_live IS '是否处于直播模式，直播模式下会显示实时标签';

