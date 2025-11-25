import * as THREE from 'three';

/**
 * 网格对齐函数
 */
export const snapToGrid = (val, gridSize = 0.5) => {
    return Math.round(val / gridSize) * gridSize;
};

/**
 * 计算点集的中心
 */
export const calculateCenter = (points) => {
    if (!points || points.length === 0) return { x: 0, z: 0 };

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

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

/**
 * 将点集转换为相对于中心的局部坐标
 */
export const localizePoints = (points, center) => {
    return points.map(p => ({
        x: p.x - center.x,
        z: p.z - center.z
    }));
};

/**
 * 创建连续曲线几何体（支持直墙和曲线墙）
 */
export const createContinuousCurveGeometry = (points, thickness, height, tension, closed) => {
    if (!points || points.length < 2) return null;

    // 对于直墙 (tension = 0)，使用斜接连接创建正确的转角
    if (tension === 0) {
        const halfThickness = thickness / 2;
        const outerPoints = [];
        const innerPoints = [];

        // 计算每个点的斜接偏移
        for (let i = 0; i < points.length; i++) {
            const curr = new THREE.Vector3(points[i].x, 0, points[i].z);

            // 获取前一个和后一个点
            let prev, next;
            if (closed) {
                prev = new THREE.Vector3(
                    points[(i - 1 + points.length) % points.length].x,
                    0,
                    points[(i - 1 + points.length) % points.length].z
                );
                next = new THREE.Vector3(
                    points[(i + 1) % points.length].x,
                    0,
                    points[(i + 1) % points.length].z
                );
            } else {
                if (i === 0) {
                    // 第一个点：只考虑到下一个点的方向
                    next = new THREE.Vector3(points[i + 1].x, 0, points[i + 1].z);
                    const dir = new THREE.Vector3().subVectors(next, curr).normalize();
                    const normal = new THREE.Vector3(-dir.z, 0, dir.x);
                    outerPoints.push(new THREE.Vector3().copy(curr).add(normal.clone().multiplyScalar(halfThickness)));
                    innerPoints.push(new THREE.Vector3().copy(curr).add(normal.clone().multiplyScalar(-halfThickness)));
                    continue;
                } else if (i === points.length - 1) {
                    // 最后一个点：只考虑从前一个点的方向
                    prev = new THREE.Vector3(points[i - 1].x, 0, points[i - 1].z);
                    const dir = new THREE.Vector3().subVectors(curr, prev).normalize();
                    const normal = new THREE.Vector3(-dir.z, 0, dir.x);
                    outerPoints.push(new THREE.Vector3().copy(curr).add(normal.clone().multiplyScalar(halfThickness)));
                    innerPoints.push(new THREE.Vector3().copy(curr).add(normal.clone().multiplyScalar(-halfThickness)));
                    continue;
                } else {
                    prev = new THREE.Vector3(points[i - 1].x, 0, points[i - 1].z);
                    next = new THREE.Vector3(points[i + 1].x, 0, points[i + 1].z);
                }
            }

            // 计算两个方向的法线
            const dir1 = new THREE.Vector3().subVectors(curr, prev).normalize();
            const dir2 = new THREE.Vector3().subVectors(next, curr).normalize();
            const normal1 = new THREE.Vector3(-dir1.z, 0, dir1.x);
            const normal2 = new THREE.Vector3(-dir2.z, 0, dir2.x);

            // 计算平均法线（斜接方向）
            const miterNormal = new THREE.Vector3().addVectors(normal1, normal2).normalize();

            // 计算斜接长度（考虑转角角度）
            const cosAngle = normal1.dot(normal2);
            const miterLength = cosAngle > -0.99 ? halfThickness / Math.sqrt((1 + cosAngle) / 2) : halfThickness;

            // 限制斜接长度，避免过尖的角
            const clampedMiterLength = Math.min(miterLength, halfThickness * 3);

            outerPoints.push(new THREE.Vector3().copy(curr).add(miterNormal.clone().multiplyScalar(clampedMiterLength)));
            innerPoints.push(new THREE.Vector3().copy(curr).add(miterNormal.clone().multiplyScalar(-clampedMiterLength)));
        }

        // 创建形状
        const shape = new THREE.Shape();

        // 沿外侧绘制
        shape.moveTo(outerPoints[0].x, -outerPoints[0].z);
        for (let i = 1; i < outerPoints.length; i++) {
            shape.lineTo(outerPoints[i].x, -outerPoints[i].z);
        }

        // 如果闭合，连接回起点
        if (closed) {
            shape.lineTo(outerPoints[0].x, -outerPoints[0].z);
        }

        // 沿内侧返回
        for (let i = innerPoints.length - 1; i >= 0; i--) {
            shape.lineTo(innerPoints[i].x, -innerPoints[i].z);
        }

        shape.closePath();

        const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
        geom.rotateX(-Math.PI / 2);
        return geom;
    }

    // 对于曲线墙 (tension > 0)，使用 CatmullRomCurve3
    const vectorPoints = points.map(p => new THREE.Vector3(p.x, 0, p.z));
    const curve = new THREE.CatmullRomCurve3(vectorPoints, closed, 'catmullrom', tension);
    const pointsCount = points.length * 12;
    const curvePoints = curve.getPoints(pointsCount);
    const shapePoints = [];

    for (let i = 0; i < curvePoints.length; i++) {
        const p = curvePoints[i];
        let tangent;
        if (closed) {
            const next = curvePoints[(i + 1) % curvePoints.length];
            const prev = curvePoints[(i - 1 + curvePoints.length) % curvePoints.length];
            tangent = new THREE.Vector3().subVectors(next, prev).normalize();
        } else {
            if (i < curvePoints.length - 1) {
                tangent = new THREE.Vector3().subVectors(curvePoints[i + 1], p).normalize();
            } else {
                tangent = new THREE.Vector3().subVectors(p, curvePoints[i - 1]).normalize();
            }
        }
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
        const pLeft = new THREE.Vector3().copy(p).add(normal.clone().multiplyScalar(thickness / 2));
        const pRight = new THREE.Vector3().copy(p).add(normal.clone().multiplyScalar(-thickness / 2));
        shapePoints.push({ left: pLeft, right: pRight });
    }

    const shape = new THREE.Shape();
    shape.moveTo(shapePoints[0].left.x, -shapePoints[0].left.z);
    for (let i = 1; i < shapePoints.length; i++) {
        shape.lineTo(shapePoints[i].left.x, -shapePoints[i].left.z);
    }
    if (closed) {
        shape.lineTo(shapePoints[0].left.x, -shapePoints[0].left.z);
    }
    for (let i = shapePoints.length - 1; i >= 0; i--) {
        shape.lineTo(shapePoints[i].right.x, -shapePoints[i].right.z);
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    return geom;
};
