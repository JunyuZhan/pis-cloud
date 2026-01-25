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
