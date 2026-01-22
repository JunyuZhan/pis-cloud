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
