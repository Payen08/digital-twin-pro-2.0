import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// 生成 UUID
export const generateUUID = () => uuidv4();

// 计算点集的中心点
export const calculateCenter = (points) => {
    if (!points || points.length === 0) return { x: 0, z: 0 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    });
    return {
        x: (minX + maxX) / 2,
        z: (minZ + maxZ) / 2
    };
};

// 将世界坐标转换为相对于中心的局部坐标
export const localizePoints = (points, center) => {
    return points.map(p => ({
        x: p.x - center.x,
        z: p.z - center.z
    }));
};

// 获取对象的角点 (用于框选计算)
export const getObjectCorners = (obj) => {
    const halfScaleX = obj.scale[0] / 2;
    const halfScaleZ = obj.scale[2] / 2;
    // 简单的矩形包围盒计算，未考虑旋转（简化版）
    // 如果需要精确旋转包围盒，需要应用旋转矩阵
    return [
        new THREE.Vector3(obj.position[0] - halfScaleX, obj.position[1], obj.position[2] - halfScaleZ),
        new THREE.Vector3(obj.position[0] + halfScaleX, obj.position[1], obj.position[2] - halfScaleZ),
        new THREE.Vector3(obj.position[0] + halfScaleX, obj.position[1], obj.position[2] + halfScaleZ),
        new THREE.Vector3(obj.position[0] - halfScaleX, obj.position[1], obj.position[2] + halfScaleZ),
    ];
};

// 将 3D 坐标投影到屏幕坐标
export const projectToScreen = (vector, rect, camera) => {
    const widthHalf = 0.5 * rect.width;
    const heightHalf = 0.5 * rect.height;
    vector.project(camera);
    return {
        x: (vector.x * widthHalf) + widthHalf + rect.left,
        y: -(vector.y * heightHalf) + heightHalf + rect.top
    };
};
