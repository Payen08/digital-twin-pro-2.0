import { v4 as uuidv4 } from 'uuid';

/**
 * 创建点对象
 */
export const createPoint = (position, subtype = 'waypoint', options = {}) => ({
    id: uuidv4(),
    type: 'point',
    subtype, // 'station', 'charger', 'waypoint'
    position: [position.x, position.y, position.z],
    state: 'active',
    name: `Point ${subtype}`,
    visible: true,
    locked: false,
    // Digital Twin fields
    sourceRefId: options.sourceRefId || null,
    isBaseMap: false
});

/**
 * 创建路径对象
 */
export const createPath = (sourceId, targetId, options = {}) => ({
    id: uuidv4(),
    type: 'path',
    sourceId,
    targetId,
    controlPoints: [],
    attributes: { width: 0.2, type: 'bidirectional', speedLimit: 1.0 },
    name: 'Path',
    visible: true,
    locked: false,
    // Digital Twin fields
    sourceRefId: options.sourceRefId || null,
    isBaseMap: false
});

/**
 * 创建设备对象
 */
export const createDevice = (modelUrl, position, options = {}) => ({
    id: uuidv4(),
    type: 'device',
    modelUrl,
    position: [position.x, position.y, position.z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    dimensions: { length: 1, width: 1, height: 1 },
    name: 'Device',
    visible: true,
    locked: false,
    // Digital Twin fields
    sourceRefId: options.sourceRefId || null,
    isBaseMap: false,
    visualConfig: {
        useCustomModel: !!modelUrl,
        modelUrl: modelUrl,
        originalSpec: {
            modelType: options.modelType || 'standard',
            dimensions: options.dimensions || [1, 1, 1]
        }
    },
    behavior: {
        interaction: options.interaction || null
    }
});

/**
 * SLAM 底图工厂
 */
export const createBaseMap = (slamConfig) => {
    const mapWidth = slamConfig.widthPx * slamConfig.resolution;
    const mapHeight = slamConfig.heightPx * slamConfig.resolution;

    // Center the map at world origin (0, 0) for easier editing
    const mapX = 0;
    const mapZ = 0;

    return {
        id: 'base_slam_map',
        type: 'floor',
        name: 'SLAM底图',
        position: [mapX, -0.1, mapZ],
        rotation: [0, 0, 0],
        scale: [mapWidth, mapHeight, 1],
        color: '#444',
        textureUrl: slamConfig.imageUrl,
        visible: true,
        locked: true,
        isBaseMap: true,
        sourceRefId: null,
        slamMetadata: {
            resolution: slamConfig.resolution,
            origin: slamConfig.origin,
            widthPx: slamConfig.widthPx,
            heightPx: slamConfig.heightPx
        }
    };
};
