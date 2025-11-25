/**
 * 楼层数据加载器
 * 用于从 JSON 文件加载 SLAM 地图和点位数据
 */

/**
 * 从 JSON 数据中提取楼层信息
 * @param {Object} jsonData - 原始 JSON 数据
 * @returns {Array} 楼层数组
 */
export function extractFloorsFromJSON(jsonData) {
    if (!jsonData || !jsonData.mapfileEntitys || !jsonData.graphTopologys) {
        console.error('Invalid JSON data structure');
        return [];
    }

    // 创建地图ID到地图数据的映射
    const mapIdToData = {};
    
    // 从 mapfileEntitys 中提取地图信息
    // 注意：这里假设每个地图对应一个楼层
    jsonData.mapfileEntitys.forEach((mapEntity, index) => {
        const record = mapEntity.record;
        const mapId = record.uid || `map_${index}`;
        
        mapIdToData[mapId] = {
            id: mapId,
            name: record.name || record.alias || `地图${index + 1}`,
            description: record.description || '',
            imageData: mapEntity.content, // base64 编码的图片
            origin: record.origin,
            resolution: record.resolution,
            width: record.width,
            height: record.height,
            ownerGraphName: record.ownerGraphName
        };
    });

    // 从 graphTopologys 中提取点位信息
    const graphTopology = jsonData.graphTopologys[0]; // 假设只有一个拓扑图
    const poses = graphTopology?.poses || [];
    
    // 按 mapFileId 分组点位
    const mapFileIdToPoses = {};
    poses.forEach(pose => {
        const mapFileId = pose.options?.mapFileId;
        if (mapFileId) {
            if (!mapFileIdToPoses[mapFileId]) {
                mapFileIdToPoses[mapFileId] = [];
            }
            mapFileIdToPoses[mapFileId].push(pose);
        }
    });

    // 识别不同的楼层（通过点位名称中的"一楼"、"二楼"等关键词）
    const floorKeywords = {
        '1': ['一楼', '1楼', '1F'],
        '2': ['二楼', '2楼', '2F'],
        '3': ['三楼', '3楼', '3F'],
        '4': ['四楼', '4楼', '4F'],
        '5': ['五楼', '5楼', '5F']
    };

    // 分析点位，确定楼层
    const mapFileIdToFloor = {};
    Object.entries(mapFileIdToPoses).forEach(([mapFileId, posesArray]) => {
        // 统计每个楼层关键词出现的次数
        const floorCounts = {};
        posesArray.forEach(pose => {
            const name = pose.name || pose.alias || '';
            Object.entries(floorKeywords).forEach(([floorNum, keywords]) => {
                if (keywords.some(keyword => name.includes(keyword))) {
                    floorCounts[floorNum] = (floorCounts[floorNum] || 0) + 1;
                }
            });
        });
        
        // 选择出现次数最多的楼层
        let maxCount = 0;
        let detectedFloor = '1'; // 默认为1楼
        Object.entries(floorCounts).forEach(([floorNum, count]) => {
            if (count > maxCount) {
                maxCount = count;
                detectedFloor = floorNum;
            }
        });
        
        mapFileIdToFloor[mapFileId] = detectedFloor;
    });

    // 创建楼层数据结构
    const floors = [];
    const floorMap = {}; // 用于去重

    Object.entries(mapFileIdToPoses).forEach(([mapFileId, posesArray]) => {
        const floorNum = mapFileIdToFloor[mapFileId] || '1';
        
        if (!floorMap[floorNum]) {
            floorMap[floorNum] = {
                id: floorNum,
                name: `${floorNum}楼`,
                description: `包含 ${posesArray.length} 个点位`,
                baseMapId: mapFileId,
                mapFileId: mapFileId,
                poses: posesArray,
                objects: []
            };
        } else {
            // 合并点位
            floorMap[floorNum].poses.push(...posesArray);
            floorMap[floorNum].description = `包含 ${floorMap[floorNum].poses.length} 个点位`;
        }
    });

    // 转换为数组并排序
    floors.push(...Object.values(floorMap).sort((a, b) => parseInt(a.id) - parseInt(b.id)));

    return floors;
}

/**
 * 将点位数据转换为 3D 对象
 * @param {Object} pose - 点位数据
 * @param {Object} mapData - 地图数据（用于坐标转换）
 * @returns {Object} 3D 对象
 */
export function poseToWaypoint(pose, mapData) {
    // ROS 坐标系到 Three.js 坐标系的转换
    // ROS: x向前, y向左, z向上
    // Three.js: x向右, y向上, z向前
    
    const x = pose.x;
    const z = -pose.y; // ROS的y轴对应Three.js的-z轴
    const y = 0.1; // 点位高度
    
    // 转换旋转角度
    const rotationY = -pose.yaw; // ROS的yaw对应Three.js的-rotationY
    
    return {
        id: `waypoint_${pose.uid}`,
        type: 'waypoint',
        name: pose.name || pose.alias || `点位${pose.uid}`,
        description: pose.description || '',
        position: [x, y, z],
        rotation: [0, rotationY, 0],
        scale: [0.3, 0.3, 0.3],
        color: getPoseColor(pose),
        visible: true,
        locked: false,
        // 保存原始数据
        poseData: pose
    };
}

/**
 * 根据点位类型获取颜色
 * @param {Object} pose - 点位数据
 * @returns {string} 颜色值
 */
function getPoseColor(pose) {
    const poseType = pose.options?.poseType || 'NORMAL';
    
    switch (poseType) {
        case 'ELEVATOR':
            return '#ff6b6b'; // 红色 - 电梯
        case 'BAY':
            return '#4ecdc4'; // 青色 - 停车位
        case 'NORMAL':
        default:
            return '#95e1d3'; // 绿色 - 普通点位
    }
}

/**
 * 将 SLAM 地图数据转换为底图对象
 * @param {Object} mapData - 地图数据
 * @param {string} imageData - base64 编码的图片数据或 URL
 * @returns {Object} 底图对象
 */
export function mapDataToBaseMap(mapData, imageData) {
    const origin = mapData.origin || { x: 0, y: 0 };
    const resolution = mapData.resolution || 0.05;
    
    // 支持两种格式
    let width, height;
    if (mapData.actualSize) {
        // 格式2: 简单地图对象
        width = mapData.actualSize.width;
        height = mapData.actualSize.height;
    } else {
        // 格式1: 完整拓扑数据
        width = mapData.width || 100;
        height = mapData.height || 100;
    }
    
    // 计算实际尺寸（米）
    const realWidth = width * resolution;
    const realHeight = height * resolution;
    
    // 计算中心位置
    const centerX = origin.x + realWidth / 2;
    const centerZ = -(origin.y + realHeight / 2); // 注意坐标转换
    
    // 处理图片数据
    let finalImageData;
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        // URL 格式
        finalImageData = imageData;
    } else if (imageData.startsWith('data:image')) {
        // 已经是 data URL
        finalImageData = imageData;
    } else {
        // base64 编码
        finalImageData = `data:image/png;base64,${imageData}`;
    }
    
    return {
        id: `basemap_${mapData.id || mapData.uid || Date.now()}`,
        type: 'map_image',
        name: `SLAM地图 - ${mapData.name || mapData.alias || '未命名'}`,
        description: mapData.description || '',
        position: [centerX, 0.01, centerZ],
        rotation: [-Math.PI / 2, 0, 0], // 平铺在地面
        scale: [realWidth, realHeight, 1],
        imageData: finalImageData,
        visible: true,
        locked: true,
        isBaseMap: true,
        // 保存原始数据
        mapData: mapData
    };
}

/**
 * 加载楼层数据
 * @param {string} jsonPath - JSON 文件路径
 * @returns {Promise<Object>} 包含楼层和地图数据的对象
 */
export async function loadFloorData(jsonPath = '/1.5_地图_1763709378606.json') {
    try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`Failed to load floor data: ${response.statusText}`);
        }
        
        const jsonData = await response.json();
        
        // 检测 JSON 格式
        if (jsonData.mapfileEntitys && jsonData.graphTopologys) {
            // 格式1: 完整的地图拓扑数据（1.5_地图_1763709378606.json）
            const floors = extractFloorsFromJSON(jsonData);
            
            const mapDataMap = {};
            jsonData.mapfileEntitys?.forEach((mapEntity, index) => {
                const record = mapEntity.record;
                const mapId = record.uid || `map_${index}`;
                mapDataMap[mapId] = {
                    ...record,
                    imageData: mapEntity.content
                };
            });
            
            return {
                floors,
                mapDataMap,
                rawData: jsonData,
                format: 'topology'
            };
        } else if (jsonData.id && jsonData.imageData) {
            // 格式2: 简单地图对象（2025年11月24日10时14分31地图文件.json）
            const floor = {
                id: '1',
                name: jsonData.name || '地图',
                description: `分辨率: ${jsonData.resolution}`,
                baseMapId: jsonData.id,
                mapFileId: jsonData.id,
                poses: [],
                objects: [],
                mapData: jsonData
            };
            
            return {
                floors: [floor],
                mapDataMap: {
                    [jsonData.id]: jsonData
                },
                rawData: jsonData,
                format: 'simple'
            };
        } else {
            throw new Error('Unknown JSON format');
        }
    } catch (error) {
        console.error('Error loading floor data:', error);
        return {
            floors: [],
            mapDataMap: {},
            rawData: null,
            format: 'unknown'
        };
    }
}

/**
 * 获取可用的地图列表
 * @returns {Array} 地图文件列表
 */
export function getAvailableMaps() {
    return [
        {
            id: 'map1',
            name: '1.5楼层地图',
            path: '/1.5_地图_1763709378606.json',
            description: '包含完整的点位和路径数据'
        },
        {
            id: 'map2',
            name: '新二楼地图',
            path: '/2025年11月24日10时14分31地图文件.json',
            description: 'xinerlou 地图'
        }
    ];
}
