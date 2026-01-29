-- ============================================
-- PIS 数据库初始化脚本（PostgreSQL）
-- ============================================
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- 创建完整的数据库架构，无需手动执行迁移
-- ============================================

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 用于全文搜索

-- ============================================
-- 用户表（自定义认证模式使用）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(500) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',  -- admin, viewer
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 相册表
-- ============================================
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cover_photo_id UUID,
    photo_count INTEGER DEFAULT 0,
    password VARCHAR(255),  -- 相册访问密码（可选）
    is_public BOOLEAN DEFAULT false,
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type VARCHAR(50) DEFAULT 'text',
    watermark_config JSONB DEFAULT '{}',
    color_grading JSONB DEFAULT '{}',
    layout VARCHAR(50) DEFAULT 'masonry',
    sort_order VARCHAR(50) DEFAULT 'captured_at_desc',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_deleted_at ON albums(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 照片表
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_key VARCHAR(500) NOT NULL,  -- MinIO 原图路径
    thumb_key VARCHAR(500),              -- 缩略图路径
    preview_key VARCHAR(500),            -- 预览图路径
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(100),
    blur_data TEXT,                       -- BlurHash
    exif JSONB DEFAULT '{}',
    rotation INTEGER DEFAULT 0,           -- 旋转角度
    sort_order INTEGER DEFAULT 0,
    group_name VARCHAR(255),              -- 照片分组
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    captured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos(album_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- 打包下载表
-- ============================================
CREATE TABLE IF NOT EXISTS package_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    photo_ids UUID[] NOT NULL,
    include_watermarked BOOLEAN DEFAULT true,
    include_original BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    zip_key VARCHAR(500),                 -- MinIO ZIP 文件路径
    file_size BIGINT,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX IF NOT EXISTS idx_package_downloads_status ON package_downloads(status);

-- ============================================
-- 辅助函数：增量更新相册照片数量
-- ============================================
CREATE OR REPLACE FUNCTION increment_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums 
    SET photo_count = (
        SELECT COUNT(*) FROM photos 
        WHERE photos.album_id = increment_photo_count.album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    )
    WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 辅助函数：减量更新相册照片数量
-- ============================================
CREATE OR REPLACE FUNCTION decrement_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums 
    SET photo_count = GREATEST(0, (
        SELECT COUNT(*) FROM photos 
        WHERE photos.album_id = decrement_photo_count.album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    ))
    WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 albums 表创建触发器
DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 photos 表创建触发器
DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
CREATE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 users 表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始化完成提示
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ PIS 数据库初始化完成！';
    RAISE NOTICE '   - users 表: 存储管理员账号（自定义认证模式）';
    RAISE NOTICE '   - albums 表: 存储相册信息';
    RAISE NOTICE '   - photos 表: 存储照片信息';
    RAISE NOTICE '   - package_downloads 表: 存储打包下载任务';
END $$;
