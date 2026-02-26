-- ========================================
-- Supabase SQL 脚本 - Digital Twin Pro 2.0
-- 在 Supabase Dashboard → SQL Editor 中运行
-- ========================================

-- 1. 创建 scenes 表（场景）
CREATE TABLE IF NOT EXISTS scenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建 floor_levels 表（楼层）
CREATE TABLE IF NOT EXISTS floor_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建 base_maps 表（底图）
CREATE TABLE IF NOT EXISTS base_maps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    floor_id UUID REFERENCES floor_levels(id) ON DELETE CASCADE,
    image_url TEXT,
    origin_x FLOAT DEFAULT 0,
    origin_y FLOAT DEFAULT 0,
    resolution FLOAT DEFAULT 0.05,
    width FLOAT DEFAULT 10,
    height FLOAT DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建 glb_models 表（3D模型）
CREATE TABLE IF NOT EXISTS glb_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    floor_id UUID REFERENCES floor_levels(id) ON DELETE CASCADE,
    file_name TEXT,
    model_url TEXT,
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    position_z FLOAT DEFAULT 0,
    scale_x FLOAT DEFAULT 1,
    scale_y FLOAT DEFAULT 1,
    scale_z FLOAT DEFAULT 1,
    rotation_x FLOAT DEFAULT 0,
    rotation_y FLOAT DEFAULT 0,
    rotation_z FLOAT DEFAULT 0,
    locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建 scene_objects 表（场景对象）
CREATE TABLE IF NOT EXISTS scene_objects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    floor_id UUID REFERENCES floor_levels(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT,
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    position_z FLOAT DEFAULT 0,
    scale_x FLOAT DEFAULT 1,
    scale_y FLOAT DEFAULT 1,
    scale_z FLOAT DEFAULT 1,
    rotation_x FLOAT DEFAULT 0,
    rotation_y FLOAT DEFAULT 0,
    rotation_z FLOAT DEFAULT 0,
    color TEXT DEFAULT '#888888',
    opacity FLOAT DEFAULT 1,
    visible BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    model_url TEXT,
    model_scale FLOAT DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建 custom_assets 表（自定义资产库）
CREATE TABLE IF NOT EXISTS custom_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    model_url TEXT NOT NULL,
    icon_url TEXT,
    model_scale FLOAT DEFAULT 1,
    auto_fit_to_slam BOOLEAN DEFAULT TRUE,
    json_data TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_floor_levels_scene_id ON floor_levels(scene_id);
CREATE INDEX IF NOT EXISTS idx_base_maps_floor_id ON base_maps(floor_id);
CREATE INDEX IF NOT EXISTS idx_glb_models_floor_id ON glb_models(floor_id);
CREATE INDEX IF NOT EXISTS idx_scene_objects_floor_id ON scene_objects(floor_id);

-- 7. 启用 RLS（Row Level Security）- 允许匿名访问
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE glb_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_assets ENABLE ROW LEVEL SECURITY;

-- 8. 创建公开访问策略（允许所有操作）
CREATE POLICY "Allow all access to scenes" ON scenes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to floor_levels" ON floor_levels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to base_maps" ON base_maps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to glb_models" ON glb_models FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to scene_objects" ON scene_objects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to custom_assets" ON custom_assets FOR ALL USING (true) WITH CHECK (true);

-- 9. 创建 Storage Bucket（用于存储 GLB 文件）
-- 在 Supabase Dashboard → Storage → Create new bucket
-- Bucket 名称: models
-- 设置为 Public

-- ========================================
-- 配置完成后，获取以下信息填入 .env 文件：
-- 1. Project URL: https://xxx.supabase.co
-- 2. Anon Key: eyJxx...
-- ========================================
