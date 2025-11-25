/**
 * 完整地图 JSON 解析器
 * 解析 SLAM 底图、点位、路径的完整数据
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 解析完整的地图 JSON
 * @param {string|object} jsonInput - JSON 字符串或对象
 * @returns {object} { baseMap, entities, paths }
 */
export const parseFullMapJson = (jsonInput) => {
    console.log('🔍 [mapParser] parseFullMapJson 被调用');
    const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    
    // 1. 解析底图 (SLAM Map)
    let baseMap = null;
    const mapEntity = data.mapfileEntitys?.[0];
    
    if (mapEntity) {
        const record = mapEntity.record;
        const content = mapEntity.content;
        
        if (record && content) {
            const widthMeters = record.width * record.resolution;
            const heightMeters = record.height * record.resolution;
            
            // 坐标系转换：ROS origin -> Three.js Center
            const centerX = record.origin.x + (widthMeters / 2);
            const centerZ = -(record.origin.y + (heightMeters / 2)); // 注意 Y 轴反转
            
            baseMap = {
                id: 'base_slam_map', // 固定ID，方便查找顶替
                type: 'map_image',
                isBaseMap: true,
                name: record.name || record.alias || '地图底图',
                position: [0, -0.01, 0], // 统一使用原点位置
                rotation: [0, 0, 0],
                scale: [widthMeters, 1, heightMeters],
                color: '#ffffff',
                opacity: 0.8,
                visible: true,
                locked: true,
                imageData: content.startsWith('data:') || content.startsWith('http') 
                    ? content 
                    : `data:image/png;base64,${content}`,
                mapMetadata: record
            };
        }
    } else if (data.id && data.imageData) {
        // 简单格式的地图
        const mapWidth = data.actualSize.width * data.resolution;
        const mapHeight = data.actualSize.height * data.resolution;
        
        baseMap = {
            id: 'base_slam_map',
            type: 'map_image',
            isBaseMap: true,
            name: data.name || '地图底图',
            position: [0, -0.01, 0],
            rotation: [0, 0, 0],
            scale: [mapWidth, 1, mapHeight],
            color: '#ffffff',
            opacity: 0.8,
            visible: true,
            locked: true,
            imageData: data.imageData,
            mapMetadata: data
        };
    }
    
    // 2. 解析拓扑路网 (Poses & Paths) 并提取楼层信息
    const entities = [];
    const paths = [];
    const poseLookup = {}; // 辅助查找表
    const floorLevelsMap = {}; // 楼层信息收集
    
    const topology = data.graphTopologys?.[0];
    
    if (topology) {
        // 处理点位
        topology.poses?.forEach(pose => {
            poseLookup[pose.name] = { x: pose.x, y: pose.y };
            
            // 提取楼层信息
            const mapFileId = pose.options?.mapFileId;
            const poseName = pose.name || pose.alias || '';
            
            // 从点位名称推断楼层
            let floorLevel = '1F'; // 默认1楼
            let floorHeight = 0;
            
            if (poseName.includes('二楼') || poseName.includes('2楼') || poseName.includes('2F')) {
                floorLevel = '2F';
                floorHeight = 3; // 默认层高3米
            } else if (poseName.includes('三楼') || poseName.includes('3楼') || poseName.includes('3F')) {
                floorLevel = '3F';
                floorHeight = 6;
            } else if (poseName.includes('四楼') || poseName.includes('4楼') || poseName.includes('4F')) {
                floorLevel = '4F';
                floorHeight = 9;
            } else if (poseName.includes('五楼') || poseName.includes('5楼') || poseName.includes('5F')) {
                floorLevel = '5F';
                floorHeight = 12;
            } else if (poseName.includes('一楼') || poseName.includes('1楼') || poseName.includes('1F')) {
                floorLevel = '1F';
                floorHeight = 0;
            }
            
            // 收集楼层信息
            if (mapFileId) {
                if (!floorLevelsMap[mapFileId]) {
                    floorLevelsMap[mapFileId] = {
                        id: `floor-${mapFileId.substring(0, 8)}`,
                        mapFileId: mapFileId,
                        name: floorLevel,
                        height: floorHeight,
                        visible: true,
                        poseCount: 0,
                        objects: []
                    };
                }
                floorLevelsMap[mapFileId].poseCount++;
                // 更新楼层名称为出现最多的
                if (floorLevel !== '1F') {
                    floorLevelsMap[mapFileId].name = floorLevel;
                    floorLevelsMap[mapFileId].height = floorHeight;
                }
            }
            
            const entity = {
                id: uuidv4(), // 内部唯一ID
                sourceRefId: String(pose.uid), // 🔒 核心绑定键：路网原始ID
                type: 'waypoint',
                name: pose.name || pose.alias,
                // 坐标转换：ROS (x, y) -> Three.js (x, 0.1, z)
                position: [pose.x, 0.1, pose.y],
                rotation: [0, -pose.yaw, 0],
                scale: [0.3, 0.3, 0.3],
                // 默认颜色配置
                color: pose.parkable ? '#4CAF50' : (pose.dockable ? '#2196F3' : '#FFC107'),
                opacity: 1,
                visible: true,
                poseData: pose,
                mapFileId: mapFileId, // 保存 mapFileId 用于楼层关联
                floorLevel: floorLevel, // 保存推断的楼层
                // 视觉配置（可被用户自定义）
                visualConfig: {
                    modelUrl: null, // 默认方块
                    customColor: null,
                    customScale: null
                }
            };
            
            entities.push(entity);
        });
        
        // 处理路径
        topology.paths?.forEach(path => {
            const start = poseLookup[path.sourceName];
            const end = poseLookup[path.targetName];
            
            if (start && end) {
                paths.push({
                    id: uuidv4(),
                    sourceRefId: String(path.uid), // 路径的原始ID
                    type: 'path_line',
                    name: path.name || `路径 ${path.sourceName} -> ${path.targetName}`,
                    points: [
                        { x: start.x, z: start.y },
                        { x: end.x, z: end.y }
                    ],
                    position: [0, 0.05, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                    color: path.bidirectional ? '#00FF00' : '#FF9800',
                    opacity: 0.8,
                    visible: true,
                    pathData: path
                });
            }
        });
    }
    
    // 将楼层信息转换为数组并排序
    const floorLevels = Object.values(floorLevelsMap)
        .sort((a, b) => {
            // 按楼层数字排序
            const aNum = parseInt(a.name.replace(/[^\d]/g, '')) || 0;
            const bNum = parseInt(b.name.replace(/[^\d]/g, '')) || 0;
            return aNum - bNum;
        });
    
    // 如果没有解析到楼层信息，创建默认的1F
    if (floorLevels.length === 0) {
        floorLevels.push({
            id: 'floor-default',
            name: '1F',
            height: 0,
            visible: true,
            poseCount: entities.length,
            objects: []
        });
    }
    
    console.log('🏢 解析到楼层:', floorLevels.map(f => `${f.name}(${f.poseCount}个点位)`).join(', '));
    console.log('🏢 floorLevels 详细信息:', floorLevels);
    
    const result = { 
        baseMap, 
        entities, 
        paths,
        floorLevels, // 新增：楼层信息
        rawData: data // 保留原始数据
    };
    
    console.log('📦 [mapParser] 返回结果:', {
        hasBaseMap: !!result.baseMap,
        entitiesCount: result.entities.length,
        pathsCount: result.paths.length,
        floorLevelsCount: result.floorLevels?.length || 0,
        floorLevels: result.floorLevels
    });
    
    return result;
};

/**
 * 检查空间冲突
 * @param {Array} newItems - 新导入的实体
 * @param {Array} oldItems - 现有的实体
 * @param {number} threshold - 冲突阈值（米）
 * @returns {Array} 冲突列表
 */
export const checkSpatialConflicts = (newItems, oldItems, threshold = 0.5) => {
    const conflicts = [];
    
    // 只检测"纯虚拟物体"（没有 sourceRefId）和"新导入的路网点位"之间的冲突
    const virtualItems = oldItems.filter(o => !o.sourceRefId && !o.isBaseMap && o.type !== 'floor');
    
    newItems.forEach(newItem => {
        virtualItems.forEach(vItem => {
            const dx = newItem.position[0] - vItem.position[0];
            const dz = newItem.position[2] - vItem.position[2];
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < threshold) {
                conflicts.push({
                    newItem: {
                        id: newItem.id,
                        name: newItem.name,
                        position: newItem.position
                    },
                    existingItem: {
                        id: vItem.id,
                        name: vItem.name,
                        position: vItem.position
                    },
                    distance: dist.toFixed(2)
                });
            }
        });
    });
    
    return conflicts;
};

/**
 * 智能合并实体（保留绑定关系）
 * @param {Array} newEntities - 新导入的实体
 * @param {Array} oldObjects - 现有的所有对象
 * @returns {Array} 合并后的实体
 */
export const smartMergeEntities = (newEntities, oldObjects) => {
    const mergedEntities = newEntities.map(newEnt => {
        // 尝试在现有对象中找 sourceRefId 匹配的
        const oldEnt = oldObjects.find(o => o.sourceRefId === newEnt.sourceRefId);
        
        if (oldEnt) {
            // 命中！保留旧的视觉配置，但更新位置
            console.log(`🔗 保留绑定: ${newEnt.name} (ID: ${newEnt.sourceRefId})`);
            return {
                ...oldEnt, // 继承旧对象的 ID, modelUrl, scale, color, visualConfig
                position: newEnt.position, // 更新为新路网的坐标
                rotation: newEnt.rotation, // 更新为新路网的角度
                poseData: newEnt.poseData, // 更新原始数据
                name: newEnt.name // 更新名称（可能改了）
                // sourceRefId 保持不变
            };
        } else {
            // 未命中，这是路网新增的点
            console.log(`➕ 新增点位: ${newEnt.name} (ID: ${newEnt.sourceRefId})`);
            return newEnt;
        }
    });
    
    // 检查是否有旧点位在新路网中消失了
    const newRefIds = new Set(newEntities.map(e => e.sourceRefId));
    const obsoleteEntities = oldObjects.filter(o => 
        o.sourceRefId && 
        !newRefIds.has(o.sourceRefId) &&
        o.type === 'waypoint'
    );
    
    if (obsoleteEntities.length > 0) {
        console.warn(`⚠️ 发现 ${obsoleteEntities.length} 个废弃点位:`, obsoleteEntities.map(e => e.name));
    }
    
    return mergedEntities;
};

/**
 * 检查场景是否"干净"（没有用户编辑内容）
 * @param {Array} objects - 当前场景对象
 * @returns {boolean}
 */
export const isSceneClean = (objects) => {
    // 只有基础地面，或者只有基础地面+默认场景标记
    return objects.every(obj => 
        obj.type === 'floor' || 
        obj.isBaseMap || 
        obj.isDefaultInit
    );
};
