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
-- 删除所有表（按依赖顺序，CASCADE 会自动删除关联的触发器和约束）
-- ============================================
-- 注意：使用 CASCADE 会自动删除表上的所有触发器，无需单独删除

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
