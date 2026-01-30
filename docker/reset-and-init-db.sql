-- ============================================
-- PIS Supabase 数据库重置并初始化脚本（一键执行）
-- ============================================
-- ⚠️  警告：此脚本会删除所有数据并重新创建表结构！
-- 
-- 特性：
-- - 幂等性：可以安全地多次执行
-- - 自动重置：先删除所有表，再重新创建
-- - 完整初始化：包含所有表、函数、触发器和索引
-- 
-- 使用方法：
-- 在 Supabase Dashboard -> SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 第一步：重置数据库（删除所有表、函数、触发器）
-- ============================================

-- 禁用外键约束检查（临时）
SET session_replication_role = 'replica';

-- 删除所有表（按依赖顺序，CASCADE 会自动删除关联的触发器和约束）
DROP TABLE IF EXISTS photo_group_assignments CASCADE;
DROP TABLE IF EXISTS photo_groups CASCADE;
DROP TABLE IF EXISTS package_downloads CASCADE;
DROP TABLE IF EXISTS album_templates CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除所有函数
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;

-- 重新启用外键约束检查
SET session_replication_role = 'origin';

-- ============================================
-- 第二步：初始化数据库（创建所有表、函数、触发器）
-- ============================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 用户表（自定义认证模式使用）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(500) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 相册表
-- ============================================
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug UUID UNIQUE DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    cover_photo_id UUID,
    
    -- 显示设置
    is_public BOOLEAN DEFAULT false,
    layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
    sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    allow_share BOOLEAN DEFAULT true,
    
    -- 访问控制
    password TEXT,
    expires_at TIMESTAMPTZ,
    
    -- 水印设置
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
    watermark_config JSONB DEFAULT '{}',
    
    -- 调色配置
    color_grading JSONB,
    
    -- 分享配置
    share_title TEXT,
    share_description TEXT,
    share_image_url TEXT,
    
    -- 海报配置
    poster_image_url TEXT,
    
    -- 活动元数据
    event_date TIMESTAMPTZ,
    location TEXT,
    
    -- 直播模式
    is_live BOOLEAN DEFAULT false,
    
    -- 统计
    photo_count INTEGER DEFAULT 0,
    selected_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 相册索引
CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_is_public ON albums(is_public) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_deleted_at ON albums(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_event_date ON albums(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_expires_at ON albums(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_password ON albums(password) WHERE password IS NOT NULL;

-- ============================================
-- 照片表
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
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
    rotation INTEGER DEFAULT 0,
    
    -- 排序和分组
    sort_order INTEGER DEFAULT 0,
    group_name VARCHAR(255),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 照片索引
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos(album_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- 相册模板表
-- ============================================
CREATE TABLE IF NOT EXISTS album_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- 模板配置
    is_public BOOLEAN DEFAULT false,
    layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
    sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    
    -- 访问控制
    password TEXT,
    expires_at TIMESTAMPTZ,
    
    -- 水印设置
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
    watermark_config JSONB DEFAULT '{}',
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_album_templates_name ON album_templates(name);
CREATE INDEX IF NOT EXISTS idx_album_templates_created_at ON album_templates(created_at DESC);

-- ============================================
-- 打包下载表
-- ============================================
CREATE TABLE IF NOT EXISTS package_downloads (
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
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX IF NOT EXISTS idx_package_downloads_status ON package_downloads(status);
CREATE INDEX IF NOT EXISTS idx_package_downloads_expires_at ON package_downloads(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- 照片分组表
-- ============================================
CREATE TABLE IF NOT EXISTS photo_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_name_per_album UNIQUE (album_id, name)
);

CREATE TABLE IF NOT EXISTS photo_group_assignments (
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (photo_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);

-- ============================================
-- 触发器函数：更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表创建触发器
DROP TRIGGER IF EXISTS albums_updated_at ON albums;
CREATE TRIGGER albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS photos_updated_at ON photos;
CREATE TRIGGER photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS album_templates_updated_at ON album_templates;
CREATE TRIGGER album_templates_updated_at
    BEFORE UPDATE ON album_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS package_downloads_updated_at ON package_downloads;
CREATE TRIGGER package_downloads_updated_at
    BEFORE UPDATE ON package_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS photo_groups_updated_at ON photo_groups;
CREATE TRIGGER photo_groups_updated_at
    BEFORE UPDATE ON photo_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 辅助函数：照片计数
-- ============================================
CREATE OR REPLACE FUNCTION increment_photo_count(p_album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums
    SET photo_count = (
        SELECT COUNT(*) FROM photos 
        WHERE album_id = p_album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    )
    WHERE id = p_album_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_photo_count(p_album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums
    SET photo_count = GREATEST(0, (
        SELECT COUNT(*) FROM photos 
        WHERE album_id = p_album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    ))
    WHERE id = p_album_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 辅助函数：浏览次数
-- ============================================
CREATE OR REPLACE FUNCTION increment_album_view_count(p_album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums
    SET view_count = view_count + 1
    WHERE id = p_album_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 触发器：选片数量统计
-- ============================================
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

DROP TRIGGER IF EXISTS trigger_update_selected_count ON photos;
CREATE TRIGGER trigger_update_selected_count
    AFTER UPDATE OF is_selected ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_album_selected_count();

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 数据库重置并初始化完成！';
    RAISE NOTICE '   - 所有表已创建';
    RAISE NOTICE '   - 所有函数已创建';
    RAISE NOTICE '   - 所有触发器已创建';
    RAISE NOTICE '   - 所有索引已创建';
END $$;
