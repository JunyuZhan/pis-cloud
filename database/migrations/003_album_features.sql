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
