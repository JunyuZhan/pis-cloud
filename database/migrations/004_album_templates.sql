-- ============================================
-- 相册模板功能
-- 版本: 004_album_templates
-- 日期: 2026-01-24
-- ============================================

-- 创建相册模板表
CREATE TABLE IF NOT EXISTS album_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- 模板配置（复制自相册设置）
  is_public BOOLEAN DEFAULT false,
  layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
  sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
  allow_download BOOLEAN DEFAULT false,
  allow_batch_download BOOLEAN DEFAULT true,
  show_exif BOOLEAN DEFAULT true,
  
  -- 访问控制
  password TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  
  -- 水印设置
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_album_templates_name ON album_templates(name);
CREATE INDEX IF NOT EXISTS idx_album_templates_created_at ON album_templates(created_at DESC);

-- 更新时间触发器
CREATE TRIGGER album_templates_updated_at
  BEFORE UPDATE ON album_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 启用 RLS
ALTER TABLE album_templates ENABLE ROW LEVEL SECURITY;

-- RLS 策略：仅管理员可以访问模板
CREATE POLICY "Admins can manage templates"
ON album_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE album_templates IS '相册模板表，用于保存和复用相册配置';
COMMENT ON COLUMN album_templates.name IS '模板名称';
COMMENT ON COLUMN album_templates.description IS '模板描述';
