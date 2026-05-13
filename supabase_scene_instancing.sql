-- Scene instancing / normalized storage migration
-- Use this when you want Supabase to store reusable model assets and per-object transforms separately.
-- The app can already store compact JSON in projects.scene_data; these tables are the recommended next step
-- for querying, partial updates, and very large scenes.

CREATE TABLE IF NOT EXISTS scene_model_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    asset_key TEXT NOT NULL,
    asset_id TEXT,
    type TEXT NOT NULL DEFAULT 'custom_model',
    name TEXT DEFAULT 'model',
    model_url TEXT,
    model_scale FLOAT DEFAULT 1,
    auto_fit_to_slam BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, asset_key)
);

CREATE TABLE IF NOT EXISTS scene_model_instances (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    floor_id TEXT,
    model_asset_id TEXT REFERENCES scene_model_assets(id) ON DELETE SET NULL,
    name TEXT DEFAULT 'model instance',
    position JSONB NOT NULL DEFAULT '[0,0,0]',
    rotation JSONB NOT NULL DEFAULT '[0,0,0]',
    scale JSONB NOT NULL DEFAULT '[1,1,1]',
    color TEXT,
    opacity FLOAT DEFAULT 1,
    visible BOOLEAN DEFAULT true,
    locked BOOLEAN DEFAULT false,
    floor_level TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scene_object_refs (
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    floor_id TEXT NOT NULL,
    object_id TEXT NOT NULL,
    object_kind TEXT NOT NULL DEFAULT 'object', -- object | model_instance
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY(project_id, floor_id, object_id, object_kind)
);

CREATE INDEX IF NOT EXISTS idx_scene_model_assets_project ON scene_model_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_model_instances_project ON scene_model_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_model_instances_floor ON scene_model_instances(floor_id);
CREATE INDEX IF NOT EXISTS idx_scene_object_refs_floor ON scene_object_refs(project_id, floor_id);

ALTER TABLE scene_model_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_model_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_object_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to scene_model_assets" ON scene_model_assets;
DROP POLICY IF EXISTS "Allow all access to scene_model_instances" ON scene_model_instances;
DROP POLICY IF EXISTS "Allow all access to scene_object_refs" ON scene_object_refs;

CREATE POLICY "Allow all access to scene_model_assets" ON scene_model_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to scene_model_instances" ON scene_model_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to scene_object_refs" ON scene_object_refs FOR ALL USING (true) WITH CHECK (true);
