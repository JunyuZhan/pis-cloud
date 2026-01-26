-- PIS Complete Database Schema
-- Usage:
-- 1. Execute this file in Supabase Dashboard -> SQL Editor
-- 2. Or use psql: psql $DATABASE_URL < database/full_schema.sql
--
-- ⚠️ Important Notes:
--   - This file is for fresh databases only (first-time installation)
--   - Execute only once to complete all database initialization
--   - Do NOT execute on databases with existing data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Albums table
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug UUID UNIQUE DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_id UUID,
  
  -- Display settings
  is_public BOOLEAN DEFAULT false,
  layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
  sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
  allow_download BOOLEAN DEFAULT false,
  show_exif BOOLEAN DEFAULT true,
  allow_share BOOLEAN DEFAULT true,
  
  -- Watermark configuration
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- Advanced features
  password TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  allow_batch_download BOOLEAN DEFAULT true,
  selected_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_live BOOLEAN DEFAULT false,
  
  -- Share configuration
  share_title TEXT,
  share_description TEXT,
  share_image_url TEXT,
  poster_image_url TEXT,
  
  -- Event metadata
  event_date TIMESTAMPTZ,
  location TEXT,
  
  -- Metadata
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  
  -- Storage paths
  original_key TEXT NOT NULL,
  preview_key TEXT,
  thumb_key TEXT,
  
  -- Image information
  filename TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  blur_data TEXT,
  
  -- EXIF data
  exif JSONB DEFAULT '{}',
  captured_at TIMESTAMPTZ,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Interaction state
  is_selected BOOLEAN DEFAULT false,
  rotation INTEGER DEFAULT NULL CHECK (rotation IS NULL OR rotation IN (0, 90, 180, 270)),
  
  -- Sorting
  sort_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Album templates table
CREATE TABLE album_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Template configuration
  is_public BOOLEAN DEFAULT false,
  layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
  sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
  allow_download BOOLEAN DEFAULT false,
  allow_batch_download BOOLEAN DEFAULT true,
  show_exif BOOLEAN DEFAULT true,
  
  -- Access control
  password TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Watermark settings
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
  watermark_config JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Package downloads table
CREATE TABLE package_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  
  -- Package configuration
  photo_ids UUID[] NOT NULL,
  include_watermarked BOOLEAN DEFAULT true,
  include_original BOOLEAN DEFAULT true,
  
  -- Package status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Storage information
  zip_key TEXT,
  file_size BIGINT,
  
  -- Download link
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Photo groups table
CREATE TABLE photo_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_group_name_per_album UNIQUE (album_id, name)
);

-- Photo group assignments table
CREATE TABLE photo_group_assignments (
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, group_id)
);

-- Indexes
CREATE INDEX idx_albums_slug ON albums(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_is_public ON albums(is_public) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_expires_at ON albums(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_albums_password ON albums(password) WHERE password IS NOT NULL;
CREATE INDEX idx_albums_event_date ON albums(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_album_status_captured ON photos(album_id, status, captured_at DESC) WHERE status = 'completed';
CREATE INDEX idx_photos_album_status_created ON photos(album_id, status, created_at DESC) WHERE status = 'completed';
CREATE INDEX idx_photos_album_status_sort ON photos(album_id, status, sort_order ASC) WHERE status = 'completed';
CREATE INDEX idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_photos_album_deleted ON photos(album_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_album_templates_name ON album_templates(name);
CREATE INDEX idx_album_templates_created_at ON album_templates(created_at DESC);
CREATE INDEX idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX idx_package_downloads_status ON package_downloads(status);
CREATE INDEX idx_package_downloads_expires_at ON package_downloads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);
CREATE INDEX idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);
CREATE INDEX idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER albums_updated_at BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER photos_updated_at BEFORE UPDATE ON photos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER album_templates_updated_at BEFORE UPDATE ON album_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER package_downloads_updated_at BEFORE UPDATE ON package_downloads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Photo count function (excludes deleted photos)
CREATE OR REPLACE FUNCTION increment_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  -- Note: This function is called after Worker processing completes, when photo status is already 'completed'
  -- For safety, we recalculate to ensure only non-deleted completed photos are counted
  UPDATE albums 
  SET photo_count = (
    SELECT COUNT(*) FROM photos 
    WHERE photos.album_id = albums.id 
    AND photos.status = 'completed' 
    AND photos.deleted_at IS NULL
  )
  WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- Selected photo count update function
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

CREATE TRIGGER trigger_update_selected_count
AFTER UPDATE OF is_selected ON photos
FOR EACH ROW
EXECUTE FUNCTION update_album_selected_count();

-- Photo groups updated_at trigger function
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

-- Album view count increment function
CREATE OR REPLACE FUNCTION increment_album_view_count(album_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE albums SET view_count = view_count + 1 WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- Initialize selected photo count
UPDATE albums SET selected_count = (
  SELECT COUNT(*) FROM photos 
  WHERE photos.album_id = albums.id AND is_selected = true AND status = 'completed'
);

-- Enable RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_group_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Albums are viewable by slug
CREATE POLICY "Albums are viewable by slug" 
ON albums FOR SELECT 
TO anon, authenticated
USING (deleted_at IS NULL);

-- RLS Policy: Photos inherit album visibility
CREATE POLICY "Photos are viewable if album exists"
ON photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM albums 
    WHERE albums.id = photos.album_id 
    AND albums.deleted_at IS NULL
  )
);

-- RLS Policy: Admins have full access
CREATE POLICY "Admins can do everything on albums"
ON albums FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can do everything on photos"
ON photos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage templates"
ON album_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage package downloads"
ON package_downloads FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage all photo groups"
ON photo_groups FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage all photo group assignments"
ON photo_group_assignments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS Policy: Anonymous users can view completed packages
CREATE POLICY "Public can view completed packages"
ON package_downloads FOR SELECT
TO anon, authenticated
USING (status = 'completed' AND expires_at > NOW());

-- RLS Policy: Guests can view groups of public albums
CREATE POLICY "Guests can view groups of public albums"
ON photo_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM albums
    WHERE albums.id = photo_groups.album_id
    AND albums.is_public = true
    AND albums.deleted_at IS NULL
    AND (albums.expires_at IS NULL OR albums.expires_at > NOW())
  )
);

CREATE POLICY "Guests can view group assignments of public albums"
ON photo_group_assignments FOR SELECT
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

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
