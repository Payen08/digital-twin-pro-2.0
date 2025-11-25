import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Box as BoxIcon } from 'lucide-react';

// 地图底图组件
export const MapImage = ({ data, isSelected, onSelect }) => {
    const meshRef = useRef();
    const [texture, setTexture] = useState(null);

    useEffect(() => {
        if (data.imageData) {
            const loader = new THREE.TextureLoader();
            loader.load(data.imageData, (tex) => {
                setTexture(tex);
            });
        }
    }, [data.imageData]);

    if (!texture) return null;

    return (
        <mesh
            ref={meshRef}
            position={data.position}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => { e.stopPropagation(); if (!data.locked) onSelect(data.id, e.shiftKey); }}
        >
            <planeGeometry args={[data.scale[0], data.scale[2]]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={data.opacity || 0.8}
                side={THREE.DoubleSide}
            />
            {isSelected && <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(data.scale[0], data.scale[2])]} />
                <lineBasicMaterial color="#2196F3" linewidth={2} />
            </lineSegments>}
        </mesh>
    );
};

// 点位标记组件
export const WaypointMarker = ({ data, isSelected, onSelect }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <group position={data.position} rotation={data.rotation}>
            {/* 点位圆柱 */}
            <mesh
                onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
                onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            >
                <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
                <meshStandardMaterial
                    color={isSelected ? '#2196F3' : (hovered ? '#64B5F6' : data.color)}
                    emissive={isSelected ? '#1976D2' : '#000'}
                />
            </mesh>

            {/* 方向箭头 */}
            <mesh position={[0, 0.2, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.08, 0.2, 8]} />
                <meshStandardMaterial color={isSelected ? '#2196F3' : data.color} />
            </mesh>

            {/* 标签 */}
            {(isSelected || hovered) && (
                <Html position={[0, 0.5, 0]} center distanceFactor={10}>
                    <div className="px-2 py-1 bg-black/80 text-white text-xs rounded border border-white/20 whitespace-nowrap pointer-events-none">
                        {data.name}
                    </div>
                </Html>
            )}
        </group>
    );
};

// 路径线组件
export const PathLine = ({ data, isSelected, onSelect, objects }) => {
    const [hovered, setHovered] = useState(false);

    const points = useMemo(() => {
        if (!data.pathData) return [];
        const source = objects.find(o => o.poseData && o.poseData.name === data.pathData.sourceName);
        const target = objects.find(o => o.poseData && o.poseData.name === data.pathData.targetName);

        if (!source || !target) return [];

        return [
            new THREE.Vector3(...source.position),
            new THREE.Vector3(...target.position)
        ];
    }, [data.pathData, objects]);

    if (points.length < 2) return null;

    return (
        <Line
            points={points}
            color={isSelected ? '#2196F3' : (hovered ? '#64B5F6' : (data.color || '#4CAF50'))}
            lineWidth={isSelected ? 3 : (hovered ? 2 : 1)}
            onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        />
    );
};
