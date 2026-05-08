import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库操作函数

/**
 * 获取所有场景
 */
export async function getScenes() {
    const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ 获取场景失败:', error);
        return [];
    }

    return data;
}

/**
 * 创建场景
 */
export async function createScene(name) {
    const { data, error } = await supabase
        .from('scenes')
        .insert([{ name }])
        .select()
        .single();

    if (error) {
        console.error('❌ 创建场景失败:', error);
        return null;
    }

    console.log('✅ 场景创建成功:', data);
    return data;
}

/**
 * 获取场景的所有楼层
 */
export async function getFloorLevels(sceneId) {
    const { data, error } = await supabase
        .from('floor_levels')
        .select('*')
        .eq('scene_id', sceneId)
        .order('level', { ascending: true });

    if (error) {
        console.error('❌ 获取楼层失败:', error);
        return [];
    }

    return data;
}

/**
 * 创建楼层
 */
export async function createFloorLevel(sceneId, name, level) {
    const { data, error } = await supabase
        .from('floor_levels')
        .insert([{ scene_id: sceneId, name, level }])
        .select()
        .single();

    if (error) {
        console.error('❌ 创建楼层失败:', error);
        return null;
    }

    console.log('✅ 楼层创建成功:', data);
    return data;
}

/**
 * 获取楼层的底图数据
 */
export async function getBaseMap(floorId) {
    const { data, error } = await supabase
        .from('base_maps')
        .select('*')
        .eq('floor_id', floorId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // 没有找到数据
            return null;
        }
        console.error('❌ 获取底图失败:', error);
        return null;
    }

    return data;
}

/**
 * 保存底图数据
 */
export async function saveBaseMap(floorId, baseMapData) {
    // 先检查是否已存在
    const existing = await getBaseMap(floorId);

    const mapData = {
        floor_id: floorId,
        image_url: baseMapData.imageUrl,
        origin_x: baseMapData.origin.x,
        origin_y: baseMapData.origin.y,
        resolution: baseMapData.resolution,
        width: baseMapData.actualSize.width,
        height: baseMapData.actualSize.height
    };

    if (existing) {
        // 更新
        const { data, error } = await supabase
            .from('base_maps')
            .update(mapData)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('❌ 更新底图失败:', error);
            return null;
        }

        console.log('✅ 底图更新成功:', data);
        return data;
    } else {
        // 插入
        const { data, error } = await supabase
            .from('base_maps')
            .insert([mapData])
            .select()
            .single();

        if (error) {
            console.error('❌ 保存底图失败:', error);
            return null;
        }

        console.log('✅ 底图保存成功:', data);
        return data;
    }
}

/**
 * 获取楼层的GLB模型
 */
export async function getGLBModel(floorId) {
    const { data, error } = await supabase
        .from('glb_models')
        .select('*')
        .eq('floor_id', floorId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('❌ 获取GLB模型失败:', error);
        return null;
    }

    return data;
}

/**
 * 保存GLB模型数据
 */
export async function saveGLBModel(floorId, modelData) {
    const existing = await getGLBModel(floorId);

    const glbData = {
        floor_id: floorId,
        file_name: modelData.fileName,
        model_url: modelData.url,
        position_x: modelData.position[0],
        position_y: modelData.position[1],
        position_z: modelData.position[2],
        scale_x: modelData.scale[0],
        scale_y: modelData.scale[1],
        scale_z: modelData.scale[2],
        rotation_x: 0,
        rotation_y: 0,
        rotation_z: 0,
        locked: true
    };

    if (existing) {
        const { data, error } = await supabase
            .from('glb_models')
            .update(glbData)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('❌ 更新GLB模型失败:', error);
            return null;
        }

        console.log('✅ GLB模型更新成功:', data);
        return data;
    } else {
        const { data, error } = await supabase
            .from('glb_models')
            .insert([glbData])
            .select()
            .single();

        if (error) {
            console.error('❌ 保存GLB模型失败:', error);
            return null;
        }

        console.log('✅ GLB模型保存成功:', data);
        return data;
    }
}

/**
 * 删除GLB模型
 */
export async function deleteGLBModel(floorId) {
    const { error } = await supabase
        .from('glb_models')
        .delete()
        .eq('floor_id', floorId);

    if (error) {
        console.error('❌ 删除GLB模型失败:', error);
        return false;
    }

    console.log('✅ GLB模型删除成功');
    return true;
}

/**
 * 获取楼层的所有场景对象
 */
export async function getSceneObjects(floorId) {
    const { data, error } = await supabase
        .from('scene_objects')
        .select('*')
        .eq('floor_id', floorId);

    if (error) {
        console.error('❌ 获取场景对象失败:', error);
        return [];
    }

    return data;
}

/**
 * 批量保存场景对象
 */
export async function saveSceneObjects(floorId, objects) {
    // 先删除该楼层的所有对象
    await supabase
        .from('scene_objects')
        .delete()
        .eq('floor_id', floorId);

    // 转换对象格式
    const objectsData = objects.map(obj => ({
        floor_id: floorId,
        type: obj.type,
        name: obj.name,
        position_x: obj.position[0],
        position_y: obj.position[1],
        position_z: obj.position[2],
        scale_x: obj.scale[0],
        scale_y: obj.scale[1],
        scale_z: obj.scale[2],
        rotation_x: obj.rotation[0],
        rotation_y: obj.rotation[1],
        rotation_z: obj.rotation[2],
        color: obj.color,
        opacity: obj.opacity,
        visible: obj.visible,
        locked: obj.locked || false,
        model_url: obj.modelUrl || null,
        model_scale: obj.modelScale || 1,
        metadata: {
            points: obj.points || null,
            thickness: obj.thickness || null,
            height: obj.height || null,
            tension: obj.tension || null,
            closed: obj.closed || null
        }
    }));

    // 批量插入
    const { data, error } = await supabase
        .from('scene_objects')
        .insert(objectsData)
        .select();

    if (error) {
        console.error('❌ 保存场景对象失败:', error);
        return [];
    }

    console.log(`✅ 成功保存 ${data.length} 个场景对象`);
    return data;
}

// --- Custom Assets Functions ---

/**
 * 上传资产文件到 Storage
 * @param {File} file - 文件对象
 * @returns {Promise<string|null>} - 返回公开访问 URL
 */
export async function uploadAssetFile(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
        .from('models')
        .upload(filePath, file);

    if (error) {
        console.error('❌ 上传文件失败:', error);
        return null;
    }

    // 获取公开 URL
    const { data: { publicUrl } } = supabase.storage
        .from('models')
        .getPublicUrl(filePath);

    return publicUrl;
}

/**
 * 添加自定义资产记录
 */
export async function addCustomAsset(asset) {
    const { data, error } = await supabase
        .from('custom_assets')
        .insert([{
            label: asset.label,
            model_url: asset.modelUrl,
            icon_url: asset.iconUrl, // 可选
            model_scale: asset.modelScale || 1,
            auto_fit_to_slam: asset.autoFitToSLAM !== false,
            json_data: asset.jsonData || '{}',
            scale_unit: 'm' // 默认为米
        }])
        .select()
        .single();

    if (error) {
        console.error('❌ 添加自定义资产记录失败:', error);
        throw error;
    }

    return data;
}

/**
 * 获取所有自定义资产
 */
export async function getCustomAssets() {
    const { data, error } = await supabase
        .from('custom_assets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ 获取自定义资产失败:', error);
        return [];
    }

    // 转换为前端使用的格式
    return data.map(record => ({
        id: record.id,
        label: record.label,
        modelUrl: record.model_url,
        iconUrl: record.icon_url,
        category: '自定义',
        type: 'custom_model',
        modelScale: record.model_scale,
        autoFitToSLAM: record.auto_fit_to_slam,
        jsonData: record.json_data
    }));
}

/**
 * 更新自定义资产
 */
export async function updateCustomAsset(id, updates) {
    const { data, error } = await supabase
        .from('custom_assets')
        .update({
            label: updates.label,
            model_scale: updates.modelScale,
            auto_fit_to_slam: updates.autoFitToSLAM,
            json_data: updates.jsonData,
            // model_url: updates.modelUrl // 通常不更新模型文件，若需支持替换模型需另行处理
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('❌ 更新自定义资产失败:', error);
        throw error;
    }

    return data;
}

/**
 * 删除自定义资产
 */
export async function deleteCustomAsset(id, modelUrl) {
    // 1. 删除数据库记录
    const { error: dbError } = await supabase
        .from('custom_assets')
        .delete()
        .eq('id', id);

    if (dbError) {
        console.error('❌ 删除资产记录失败:', dbError);
        return false;
    }

    // 2. 尝试删除 Storage 文件 (可选，失败不影响记录删除)
    if (modelUrl) {
        try {
            // 从 URL 提取文件名
            // 假设 URL 格式: .../storage/v1/object/public/models/filename.glb
            const urlParts = modelUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];

            if (fileName) {
                const { error: storageError } = await supabase.storage
                    .from('models')
                    .remove([fileName]);

                if (storageError) {
                    console.warn('⚠️ 删除资产文件失败 (可能是权限问题):', storageError);
                } else {
                    console.log('✅ 资产文件已清理');
                }
            }
        } catch (e) {
            console.warn('⚠️ 解析文件路径失败:', e);
        }
    }

    return true;
}

// ==========================================
// 工作区分享（编辑器ID功能）
// ==========================================

/**
 * 保存场景到分享工作区
 */
export async function saveSharedScene(shareId, sceneData, sceneName = '未命名') {
    const { data, error } = await supabase
        .from('shared_scenes')
        .upsert({
            share_id: shareId,
            scene_data: sceneData,
            scene_name: sceneName,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('❌ 保存分享场景失败:', error);
        return null;
    }
    console.log('✅ 场景已保存到工作区:', shareId);
    return data;
}

/**
 * 获取分享工作区的场景数据
 */
export async function getSharedScene(shareId) {
    const { data, error } = await supabase
        .from('shared_scenes')
        .select('*')
        .eq('share_id', shareId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            console.log('📭 工作区不存在:', shareId);
            return null;
        }
        console.error('❌ 获取分享场景失败:', error);
        return null;
    }
    console.log('📥 加载工作区场景:', shareId, data.scene_name);
    return data;
}

/**
 * 保存/更新项目
 */
export async function saveProject(workspaceId, projectName, sceneData, projectId = null) {
    const id = projectId || 'proj-' + Math.random().toString(36).slice(2, 10);
    const { data, error } = await supabase
        .from('projects')
        .upsert({
            id,
            workspace_id: workspaceId,
            project_name: projectName || '未命名方案',
            scene_data: sceneData,
            updated_at: new Date().toISOString()
        })
        .select().single();
    if (error) { console.error('❌ 保存项目失败:', error); return null; }
    return data;
}

/**
 * 获取工作区的所有项目列表
 */
export async function listProjects(workspaceId) {
    const { data, error } = await supabase
        .from('projects')
        .select('id, workspace_id, project_name, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
    if (error) { console.error('❌ 获取项目列表失败:', error); return []; }
    return data || [];
}

/**
 * 获取所有项目列表
 */
export async function listAllProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('id, workspace_id, project_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);
    if (error) { console.error('❌ 获取项目列表失败:', error); return []; }
    return data || [];
}

/**
 * 获取单个项目
 */
export async function getProject(projectId) {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
    if (error) { console.error('❌ 获取项目失败:', error); return null; }
    return data;
}

/**
 * 删除项目
 */
export async function deleteProject(projectId) {
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
    if (error) { console.error('❌ 删除项目失败:', error); return false; }
    return true;
}
