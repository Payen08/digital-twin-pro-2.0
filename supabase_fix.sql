-- ==========================================
-- Supabase 修复 SQL - 解决外键约束问题
-- 请在 Supabase Dashboard → SQL Editor 中运行
-- ==========================================

-- 问题：scene_objects.floor_id 是 UUID 外键，但代码使用字符串ID如 'floor-1'
-- 解决：移除所有外键约束，将 floor_id 改为 TEXT 类型

-- 1. 修复 scene_objects 表
ALTER TABLE IF EXISTS scene_objects DROP CONSTRAINT IF EXISTS scene_objects_floor_id_fkey;
ALTER TABLE scene_objects ALTER COLUMN floor_id TYPE TEXT;

-- 2. 修复 base_maps 表
ALTER TABLE IF EXISTS base_maps DROP CONSTRAINT IF EXISTS base_maps_floor_id_fkey;
ALTER TABLE base_maps ALTER COLUMN floor_id TYPE TEXT;

-- 3. 修复 glb_models 表
ALTER TABLE IF EXISTS glb_models DROP CONSTRAINT IF EXISTS glb_models_floor_id_fkey;
ALTER TABLE glb_models ALTER COLUMN floor_id TYPE TEXT;

-- 4. 修复 floor_levels 表（移除 scene_id 外键，改用 TEXT）
ALTER TABLE IF EXISTS floor_levels DROP CONSTRAINT IF EXISTS floor_levels_scene_id_fkey;
ALTER TABLE floor_levels ALTER COLUMN scene_id TYPE TEXT;
ALTER TABLE floor_levels ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 5. 修复 scenes 表 ID 类型
ALTER TABLE scenes ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 6. 重新创建公开访问 RLS 策略（确保存在）
DROP POLICY IF EXISTS "Allow all access to scene_objects" ON scene_objects;
CREATE POLICY "Allow all access to scene_objects" ON scene_objects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to base_maps" ON base_maps;
CREATE POLICY "Allow all access to base_maps" ON base_maps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to floor_levels" ON floor_levels;
CREATE POLICY "Allow all access to floor_levels" ON floor_levels FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to scenes" ON scenes;
CREATE POLICY "Allow all access to scenes" ON scenes FOR ALL USING (true) WITH CHECK (true);

-- 7. 验证：尝试插入测试数据
INSERT INTO scene_objects (floor_id, type, name) 
VALUES ('floor-1', 'test', 'test_object')
ON CONFLICT DO NOTHING;

DELETE FROM scene_objects WHERE name = 'test_object';

-- 完成！
SELECT '✅ Supabase 修复完成！现在可以使用字符串 floor_id' AS result;

-- ==========================================
-- 8. 工作区+项目表（多方案支持）
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,                  -- 项目ID (自动生成)
    workspace_id TEXT NOT NULL,           -- 工作区ID
    project_name TEXT DEFAULT '未命名方案',-- 方案名称
    scene_data JSONB NOT NULL,            -- 完整场景JSON
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
CREATE POLICY "Allow all access to projects" ON projects FOR ALL USING (true) WITH CHECK (true);

-- 保留旧表兼容（后续可删除）
-- shared_scenes 保持不变

-- ==========================================
-- 8. 创建工作区分享表（编辑器ID功能）
-- ==========================================
CREATE TABLE IF NOT EXISTS shared_scenes (
    share_id TEXT PRIMARY KEY,          -- 工作区ID（自定义或自动生成）
    scene_data JSONB NOT NULL,          -- 完整场景JSON（含所有对象）
    scene_name TEXT DEFAULT '未命名',   -- 场景名称
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS 策略：允许所有人读写
ALTER TABLE shared_scenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to shared_scenes" ON shared_scenes;
CREATE POLICY "Allow all access to shared_scenes" ON shared_scenes FOR ALL USING (true) WITH CHECK (true);
