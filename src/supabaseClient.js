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
