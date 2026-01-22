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
