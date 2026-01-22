-- ============================================
-- 修复 RLS 安全漏洞
-- 版本: 002_secure_rls
-- 日期: 2026-01-23
-- ============================================

-- 1. 撤销匿名用户的 UPDATE 权限
-- 原策略 "Public can select photos" 过于宽泛，允许修改所有字段
DROP POLICY IF EXISTS "Public can select photos" ON photos;

-- 2. 确认仅管理员可 UPDATE
-- 现有的 "Admins can do everything on photos" 策略已经覆盖了这一点
-- 只有 authenticated 用户（管理员）或 Service Role 可以修改数据
