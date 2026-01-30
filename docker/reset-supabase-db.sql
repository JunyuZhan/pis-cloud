-- ============================================
-- PIS Supabase 数据库重置脚本
-- ============================================
-- ⚠️  警告：此脚本会删除所有数据！
-- 使用方法：
-- 1. 在 Supabase Dashboard -> SQL Editor 中执行
-- 2. 或者使用 Supabase CLI: supabase db reset
-- ============================================

-- 禁用外键约束检查（临时）
SET session_replication_role = 'replica';

-- ============================================
-- 删除所有触发器（先删除触发器，再删除表）
-- ============================================
-- 注意：使用 CASCADE 会自动删除关联的触发器，但为了安全，先显式删除

DO $$
BEGIN
    -- 删除触发器（如果表存在）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'albums') THEN
        DROP TRIGGER IF EXISTS albums_updated_at ON albums;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photos') THEN
        DROP TRIGGER IF EXISTS photos_updated_at ON photos;
        DROP TRIGGER IF EXISTS trigger_update_selected_count ON photos;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        DROP TRIGGER IF EXISTS users_updated_at ON users;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'album_templates') THEN
        DROP TRIGGER IF EXISTS album_templates_updated_at ON album_templates;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'package_downloads') THEN
        DROP TRIGGER IF EXISTS package_downloads_updated_at ON package_downloads;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photo_groups') THEN
        DROP TRIGGER IF EXISTS photo_groups_updated_at ON photo_groups;
    END IF;
END $$;

-- ============================================
-- 删除所有表（按依赖顺序，CASCADE 会自动删除触发器）
-- ============================================

-- 删除关联表（先删除）
DROP TABLE IF EXISTS photo_group_assignments CASCADE;
DROP TABLE IF EXISTS photo_groups CASCADE;
DROP TABLE IF EXISTS package_downloads CASCADE;
DROP TABLE IF EXISTS album_templates CASCADE;

-- 删除主表
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 删除所有函数
-- ============================================
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;

-- ============================================
-- 重新启用外键约束检查
-- ============================================
SET session_replication_role = 'origin';

-- ============================================
-- 重新初始化数据库架构
-- ============================================
-- 执行 init-db.sql 或 full_schema.sql 来重新创建表结构
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 数据库重置完成！';
    RAISE NOTICE '   所有表、函数和触发器已删除';
    RAISE NOTICE '   请执行 init-db.sql 或 full_schema.sql 重新创建表结构';
END $$;
