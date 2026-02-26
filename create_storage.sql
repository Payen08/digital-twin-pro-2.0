-- ==========================================
-- 修复上传失败：创建 Storage Bucket 和策略
-- 请在 Supabase Dashboard -> SQL Editor 中运行
-- ==========================================

-- 1. 创建 'models' 存储桶 (如果不存在)
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 启用 RLS (虽然 bucket 表默认启用，但确保万无一失)
-- 注意：storage.objects 通常已经启用了 RLS

-- 3. 创建允许公开访问的策略
-- ⚠️ 先删除旧策略避免冲突
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access to models" ON storage.objects;

-- 允许所有人查看 (SELECT) 'models' 桶中的文件
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'models' );

-- 允许所有人上传 (INSERT) 到 'models' 桶
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'models' );

-- 允许所有人删除 (DELETE) 'models' 桶中的文件
CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'models' );

-- 允许所有人更新 (UPDATE) 'models' 桶中的文件
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'models' );

---------------------------------------------
-- 检查配置结果
---------------------------------------------
SELECT * FROM storage.buckets WHERE id = 'models';
