-- ============================================
-- 相册海报配置
-- 版本: 012_album_poster
-- 日期: 2026-01-26
-- ============================================

-- 添加海报图片URL字段到相册表
ALTER TABLE albums ADD COLUMN IF NOT EXISTS poster_image_url TEXT;

COMMENT ON COLUMN albums.poster_image_url IS '相册海报图片URL（用于列表展示、详情页Hero、分享预览，优先于封面照片）';
