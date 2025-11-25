import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import * as THREE from 'three';

// 可拖动的控制点
export const DraggablePoint = ({ position, onDrag, onDragEnd, color = "#ffffff", label }) => {
    const [hovered, setHovered] = useState(false);
    const [dragging, setDragging] = useState(false);
    const { camera, gl } = useThree();
    const ref = useRef();

    useEffect(() => {
        const canvas = gl.domElement;
        const handlePointerUp = () => {
            if (dragging) {
                setDragging(false);
                if (onDragEnd) onDragEnd();
            }
        };
        window.addEventListener('pointerup', handlePointerUp);
        return () => window.removeEventListener('pointerup', handlePointerUp);
    }, [dragging, onDragEnd, gl]);

    useFrame((state) => {
        if (dragging) {
            // 简单的射线投射逻辑，实际项目中可能需要更复杂的平面相交计算
            // 这里简化为跟随鼠标在 XZ 平面移动
            const vector = new THREE.Vector3(state.pointer.x, state.pointer.y, 0.5);
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.y / dir.y;
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));
            onDrag([pos.x, 0, pos.z]);
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={ref}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragging(true);
                }}
            >
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color={dragging ? "#ffff00" : (hovered ? "#00ffff" : color)} depthTest={false} transparent opacity={0.8} />
            </mesh>
            {label && <Text position={[0, 0.5, 0]} fontSize={0.3} color="white" anchorX="center" anchorY="bottom">{label}</Text>}
        </group>
    );
};

// 曲线编辑器
export const CurveEditor = ({ points, onUpdatePoint, onDragEnd, onAddPoint }) => {
    return (
        <group>
            {points.map((p, idx) => (
                <DraggablePoint
                    key={idx}
                    position={[p.x, 0, p.z]}
                    onDrag={(newPos) => onUpdatePoint(idx, { x: newPos[0], z: newPos[2] })}
                    onDragEnd={onDragEnd}
                    label={idx + 1}
                />
            ))}
            {/* 线框连接 */}
            <line>
                <bufferGeometry attach="geometry" onUpdate={self => {
                    const vertices = new Float32Array(points.length * 3);
                    points.forEach((p, i) => {
                        vertices[i * 3] = p.x;
                        vertices[i * 3 + 1] = 0;
                        vertices[i * 3 + 2] = p.z;
                    });
                    self.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                }} />
                <lineBasicMaterial attach="material" color="#666" dashSize={0.5} gapSize={0.2} />
            </line>
        </group>
    );
};

// 连续曲线墙体网格
export const ContinuousCurveMesh = ({ points, thickness = 0.2, height = 3, tension = 0.5, closed = false, color = '#8b5cf6', opacity = 1, isSelected, hovered }) => {
    const geometry = useMemo(() => {
        if (points.length < 2) return null;

        const vecPoints = points.map(p => new THREE.Vector3(p.x, 0, p.z));
        const curve = new THREE.CatmullRomCurve3(vecPoints, closed, 'catmullrom', tension);
        
        const shape = new THREE.Shape();
        shape.moveTo(-thickness / 2, 0);
        shape.lineTo(thickness / 2, 0);
        shape.lineTo(thickness / 2, height);
        shape.lineTo(-thickness / 2, height);
        shape.lineTo(-thickness / 2, 0);

        const extrudeSettings = {
            steps: points.length * 10,
            bevelEnabled: false,
            extrudePath: curve
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, [points, thickness, height, tension, closed]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
                color={color}
                transparent={opacity < 1}
                opacity={opacity}
                side={THREE.DoubleSide}
                emissive={isSelected ? '#444' : (hovered ? '#222' : '#000')}
            />
            {(isSelected || hovered) && <Html position={[points[0].x, height + 0.5, points[0].z]} center><div className="px-2 py-1 bg-black/50 text-white text-xs rounded">曲线墙</div></Html>}
        </mesh>
    );
};

// 多边形地面网格
export const PolygonFloorMesh = ({ points, color = '#334155', opacity = 1, isSelected, hovered }) => {
    const geometry = useMemo(() => {
        if (points.length < 3) return null;

        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z); // 注意：Shape 是 2D 的，这里用 x, z 作为 x, y
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        shape.lineTo(points[0].x, points[0].z);

        const extrudeSettings = {
            steps: 1,
            depth: 0.1, // 地面厚度
            bevelEnabled: false
        };

        // ExtrudeGeometry 默认是沿 Z 轴拉伸，我们需要旋转它
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.rotateX(Math.PI / 2); // 旋转使其平躺
        return geom;
    }, [points]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} castShadow receiveShadow position={[0, 0, 0]}>
            <meshStandardMaterial
                color={color}
                transparent={opacity < 1}
                opacity={opacity}
                side={THREE.DoubleSide}
                emissive={isSelected ? '#444' : (hovered ? '#222' : '#000')}
            />
        </mesh>
    );
};

// 预览墙体（绘制时显示）
export const PreviewWall = ({ start, end, height = 3, thickness = 0.2, color = '#3b82f6' }) => {
    const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2));
    const angle = -Math.atan2(end.z - start.z, end.x - start.x);
    const centerX = (start.x + end.x) / 2;
    const centerZ = (start.z + end.z) / 2;

    return (
        <mesh position={[centerX, height / 2, centerZ]} rotation={[0, angle, 0]}>
            <boxGeometry args={[length, height, thickness]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
    );
};
