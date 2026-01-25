-- ============================================
-- PIS 数据库迁移: 相册直播模式
-- 版本: 010
-- 描述: 添加相册直播模式开关
-- ============================================

-- 添加 is_live 字段到 albums 表
ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- 添加注释
COMMENT ON COLUMN albums.is_live IS '是否处于直播模式，直播模式下会显示实时标签';
