export const COMPACT_SCENE_SCHEMA = 'compact-scene-v1';

const MODEL_TYPES = new Set(['custom_model', 'cnc']);

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

const stableHash = (input) => {
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash &= 0xffffffff;
    }
    return Math.abs(hash).toString(36);
};

const shouldUseModelAsset = (obj) => {
    return !!obj?.modelUrl && (MODEL_TYPES.has(obj.type) || obj.assetId);
};

const sanitizeBaseMapData = (baseMapData) => {
    if (!baseMapData) return baseMapData;
    const copy = { ...baseMapData };
    if (isDataUrl(copy.imageUrl)) {
        copy.imageUrl = null;
        copy._imageUrlFiltered = true;
    }
    if (isDataUrl(copy.imageData)) {
        copy.imageData = null;
        copy._imageDataFiltered = true;
    }
    return copy;
};

const sanitizeObject = (obj) => {
    const copy = { ...obj };
    if (copy.type === 'map_image' && isDataUrl(copy.imageData)) {
        copy.imageData = null;
        copy._imageDataFiltered = true;
    }
    return copy;
};

export const createCompactScenePayload = ({
    objects = [],
    floors = [],
    currentFloorId,
    currentFloorLevelId,
    lightingConfig,
    currentScene,
    currentProjectId,
    currentProjectName,
    metadata = {}
} = {}) => {
    const modelAssets = [];
    const assetByKey = new Map();

    const compactObjects = objects.map((obj) => {
        const compactObj = sanitizeObject(obj);

        if (!shouldUseModelAsset(obj)) {
            return compactObj;
        }

        const assetKey = JSON.stringify({
            type: obj.type,
            modelUrl: obj.modelUrl,
            assetId: obj.assetId || null,
            modelScale: obj.modelScale || 1,
            autoFitToSLAM: obj.autoFitToSLAM !== false
        });

        let asset = assetByKey.get(assetKey);
        if (!asset) {
            asset = {
                id: `model_${stableHash(assetKey)}`,
                type: obj.type,
                name: obj.name || obj.assetId || 'model',
                assetId: obj.assetId || null,
                modelUrl: isDataUrl(obj.modelUrl) ? null : obj.modelUrl,
                modelScale: obj.modelScale || 1,
                autoFitToSLAM: obj.autoFitToSLAM !== false,
                _modelUrlFiltered: isDataUrl(obj.modelUrl)
            };
            assetByKey.set(assetKey, asset);
            modelAssets.push(asset);
        }

        delete compactObj.modelUrl;
        compactObj.modelAssetRef = asset.id;
        compactObj.modelScale = obj.modelScale || asset.modelScale;
        if (asset._modelUrlFiltered) {
            compactObj._modelUrlFiltered = true;
        }

        return compactObj;
    });

    const exportedObjectIds = new Set(compactObjects.map(obj => obj.id));
    const compactFloors = floors.map(scene => ({
        ...scene,
        floorLevels: (scene.floorLevels || []).map(floor => ({
            ...floor,
            baseMapData: sanitizeBaseMapData(floor.baseMapData),
            objects: undefined,
            objectRefs: (floor.objects || [])
                .map(obj => obj?.id)
                .filter(id => id && exportedObjectIds.has(id))
        }))
    }));

    return {
        version: '3.0',
        storageSchema: COMPACT_SCENE_SCHEMA,
        exportTime: new Date().toISOString(),
        sceneName: currentProjectName || currentScene?.name || '未命名场景',
        sceneId: currentScene?.id || 'default',
        projectId: currentProjectId || null,
        currentFloorId,
        currentFloorLevelId,
        modelAssets,
        objects: compactObjects,
        floors: compactFloors,
        lightingConfig,
        metadata: {
            ...metadata,
            objectCount: compactObjects.length,
            modelAssetCount: modelAssets.length,
            modelInstanceCount: compactObjects.filter(obj => obj.modelAssetRef).length
        }
    };
};

export const inflateCompactScenePayload = (payload) => {
    if (!payload || payload.storageSchema !== COMPACT_SCENE_SCHEMA) {
        return payload;
    }

    const assetById = new Map((payload.modelAssets || []).map(asset => [asset.id, asset]));
    const objects = (payload.objects || []).map((obj) => {
        if (!obj.modelAssetRef) return obj;

        const asset = assetById.get(obj.modelAssetRef);
        if (!asset) return obj;

        return {
            ...obj,
            modelUrl: asset.modelUrl || obj.modelUrl || null,
            assetId: obj.assetId || asset.assetId,
            modelScale: obj.modelScale || asset.modelScale || 1,
            autoFitToSLAM: obj.autoFitToSLAM ?? asset.autoFitToSLAM
        };
    });

    const objectById = new Map(objects.map(obj => [obj.id, obj]));
    const floors = (payload.floors || []).map(scene => ({
        ...scene,
        floorLevels: (scene.floorLevels || []).map(floor => ({
            ...floor,
            objects: floor.objects || (floor.objectRefs || [])
                .map(id => objectById.get(id))
                .filter(Boolean)
        }))
    }));

    return {
        ...payload,
        objects,
        floors
    };
};
