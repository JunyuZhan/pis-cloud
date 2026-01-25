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
