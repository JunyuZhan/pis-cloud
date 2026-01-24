-- ============================================
-- PIS 数据库迁移: 照片手动旋转
-- 版本: 011
-- 描述: 添加照片手动旋转角度字段
-- ============================================

-- 添加 rotation 字段到 photos 表
-- rotation 表示手动旋转的角度（0, 90, 180, 270）
-- NULL 表示使用 EXIF orientation 自动旋转
ALTER TABLE photos ADD COLUMN IF NOT EXISTS rotation INTEGER DEFAULT NULL CHECK (rotation IS NULL OR rotation IN (0, 90, 180, 270));

-- 添加注释
COMMENT ON COLUMN photos.rotation IS '手动旋转角度（度），可选值：0, 90, 180, 270。NULL 表示使用 EXIF orientation 自动旋转';
