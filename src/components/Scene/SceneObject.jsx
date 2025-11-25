import React, { useRef, useState, Suspense } from 'react';
import { useCursor, Html, TransformControls, Edges, Gltf } from '@react-three/drei';
import { BrickWall, Box as BoxIcon, LandPlot, DoorOpen, Columns, Server } from 'lucide-react';
import { ContinuousCurveMesh, PolygonFloorMesh, CurveEditor } from './DrawingComponents';

const SceneObject = ({
    data,
    isSelected,
    isEditingPoints,
    onSelect,
    transformMode,
    onTransformEnd,
    onToggleEdit,
    onUpdatePoints // 新增：用于更新点位
}) => {
    const groupRef = useRef();
    const [hovered, setHovered] = useState(false);

    useCursor(hovered && !isSelected && !isEditingPoints);

    if (!data.visible) return null;

    const isFloorType = data.type === 'floor' || data.type === 'polygon_floor';

    // 渲染复杂几何体（曲线墙、多边形地面）
    if (data.type === 'curved_wall') {
        return (
            <group
                ref={groupRef}
                position={data.position}
                rotation={data.rotation}
                scale={data.scale}
                onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey); }}
                onDoubleClick={(e) => { e.stopPropagation(); if (onToggleEdit) onToggleEdit(data.id); }}
                onPointerOver={(e) => { e.stopPropagation(); if (!isSelected) setHovered(true); }}
                onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            >
                <ContinuousCurveMesh
                    points={data.points}
                    thickness={data.thickness}
                    height={data.height}
                    tension={data.tension}
                    closed={data.closed}
                    color={data.color}
                    opacity={data.opacity}
                    isSelected={isSelected}
                    hovered={hovered}
                />
                {isSelected && isEditingPoints && (
                    <CurveEditor
                        points={data.points}
                        onUpdatePoint={(idx, newPos) => {
                            const newPoints = [...data.points];
                            newPoints[idx] = newPos;
                            onUpdatePoints(data.id, newPoints, false);
                        }}
                        onDragEnd={() => onUpdatePoints(data.id, data.points, true)}
                    />
                )}
                {/* TransformControls 只在非编辑点模式下显示 */}
                {isSelected && !isEditingPoints && transformMode && (
                    <TransformControls
                        object={groupRef}
                        mode={transformMode}
                        size={0.8}
                        space="local"
                        onMouseUp={() => {
                            if (groupRef.current) {
                                const { position, rotation, scale } = groupRef.current;
                                onTransformEnd(data.id, {
                                    position: [position.x, position.y, position.z],
                                    rotation: [rotation.x, rotation.y, rotation.z],
                                    scale: [scale.x, scale.y, scale.z]
                                });
                            }
                        }}
                    />
                )}
            </group>
        );
    }

    if (data.type === 'polygon_floor') {
        return (
            <group
                ref={groupRef}
                position={data.position}
                rotation={data.rotation}
                scale={data.scale}
                onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey); }}
                onDoubleClick={(e) => { e.stopPropagation(); if (onToggleEdit) onToggleEdit(data.id); }}
                onPointerOver={(e) => { e.stopPropagation(); if (!isSelected) setHovered(true); }}
                onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            >
                <PolygonFloorMesh
                    points={data.points}
                    color={data.color}
                    opacity={data.opacity}
                    isSelected={isSelected}
                    hovered={hovered}
                />
                {isSelected && isEditingPoints && (
                    <CurveEditor
                        points={data.points}
                        onUpdatePoint={(idx, newPos) => {
                            const newPoints = [...data.points];
                            newPoints[idx] = newPos;
                            onUpdatePoints(data.id, newPoints, false);
                        }}
                        onDragEnd={() => onUpdatePoints(data.id, data.points, true)}
                    />
                )}
                {isSelected && !isEditingPoints && transformMode && (
                    <TransformControls
                        object={groupRef}
                        mode={transformMode}
                        size={0.8}
                        space="local"
                        onMouseUp={() => {
                            if (groupRef.current) {
                                const { position, rotation, scale } = groupRef.current;
                                onTransformEnd(data.id, {
                                    position: [position.x, position.y, position.z],
                                    rotation: [rotation.x, rotation.y, rotation.z],
                                    scale: [scale.x, scale.y, scale.z]
                                });
                            }
                        }}
                    />
                )}
            </group>
        );
    }

    // 图标映射
    const getIcon = () => {
        if (data.type.includes('wall')) return <BrickWall size={10} className="text-blue-400" />;
        if (data.type === 'floor') return <LandPlot size={10} className="text-green-400" />;
        if (data.type === 'door') return <DoorOpen size={10} className="text-yellow-400" />;
        if (data.type === 'column') return <Columns size={10} className="text-gray-400" />;
        if (data.type === 'cnc') return <Server size={10} className="text-blue-500" />;
        return <BoxIcon size={10} className="text-orange-400" />;
    };

    return (
        <>
            <group
                ref={groupRef}
                name={data.id}
                position={data.position}
                rotation={data.rotation}
                scale={data.scale}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(data.id, e.shiftKey);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onToggleEdit) onToggleEdit(data.id);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    if (!isSelected) setHovered(true);
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                }}
            >
                <React.Fragment>
                    {data.modelUrl ? (
                        <Suspense fallback={
                            <mesh>
                                <boxGeometry args={[1, 1, 1]} />
                                <meshBasicMaterial color="gray" wireframe />
                            </mesh>
                        }>
                            <Gltf
                                src={data.modelUrl}
                                castShadow
                                receiveShadow
                                scale={data.modelScale || 1}
                            />
                            {(isSelected || hovered) && (
                                <mesh>
                                    <boxGeometry args={[1.05, 1.05, 1.05]} />
                                    <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.3} />
                                </mesh>
                            )}
                        </Suspense>
                    ) : (
                        <mesh castShadow receiveShadow>
                            {(data.type === 'wall' ||
                                data.type === 'floor' ||
                                data.type === 'column' ||
                                data.type === 'door' ||
                                data.type === 'cnc' ||
                                data.type === 'cube' ||
                                data.type === 'custom_model') && (
                                    <boxGeometry args={[1, 1, 1]} />
                                )}
                            <meshStandardMaterial
                                color={data.color}
                                roughness={0.5}
                                metalness={0.1}
                                opacity={data.opacity || 1}
                                transparent={(data.opacity || 1) < 1}
                                emissive={!isFloorType && isSelected ? '#444' : (!isFloorType && hovered ? '#222' : '#000')}
                            />
                            {(isSelected || hovered) && (
                                <Edges threshold={15} scale={1.001} color={isSelected ? "#60a5fa" : "#ffffff"} />
                            )}
                        </mesh>
                    )}
                </React.Fragment>

                {isSelected && !data.hideLabel && (
                    <Html position={[0, 2 + (data.scale[1] || 1), 0]} center distanceFactor={10} zIndexRange={[100, 0]}>
                        <div className="info-label flex items-center gap-2">
                            {getIcon()}
                            <span>{data.name}</span>
                        </div>
                    </Html>
                )}
            </group>

            {isSelected && !isEditingPoints && transformMode && (
                <TransformControls
                    object={groupRef}
                    mode={transformMode}
                    size={0.8}
                    space="local"
                    onMouseUp={() => {
                        if (groupRef.current) {
                            const { position, rotation, scale } = groupRef.current;
                            onTransformEnd(data.id, {
                                position: [position.x, position.y, position.z],
                                rotation: [rotation.x, rotation.y, rotation.z],
                                scale: [scale.x, scale.y, scale.z]
                            });
                        }
                    }}
                />
            )}
        </>
    );
};

export default SceneObject;
