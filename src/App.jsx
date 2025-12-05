import React, { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, TransformControls, Html, Line, Edges, Text, ContactShadows, PerspectiveCamera, OrthographicCamera, useGLTF, Grid, useCursor } from '@react-three/drei';
import {
    MousePointer2, Move, RotateCw, Maximize, Copy, Trash2, Eye, EyeOff, Lock, Unlock,
    PenTool, Spline, LandPlot, BrickWall, DoorOpen, Columns, Box, Server,
    Search, Upload, Download, Save, FolderOpen, Settings, Info,
    Undo2, Redo2, ZoomIn, ZoomOut, RotateCcw, ArrowDownToLine,
    RefreshCw, Edit3, PlusSquare, Minus, Plus, X, Check, AlertTriangle,
    LayoutTemplate, Layers3, Layers, Map, FileJson, BoxIcon, Maximize2, Home, Play, CopyCheck, Square, GripVertical, Database, ChevronDown, ChevronRight, Ruler, Magnet, PanelRightClose, PanelRight
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase
import { supabase, saveBaseMap, saveGLBModel, deleteGLBModel, getBaseMap, getGLBModel, saveSceneObjects, getSceneObjects } from './supabaseClient';

// Import utilities
import { snapToGrid, calculateCenter, localizePoints, createContinuousCurveGeometry } from './utils/geometry';
import { createPoint, createPath, createDevice, createBaseMap } from './utils/dataModels';
import { rosToThreeJS } from './utils/coordinates';
import { parseSLAMConfig } from './utils/slamParser';
import { loadFloorData, poseToWaypoint, mapDataToBaseMap, getAvailableMaps } from './utils/floorDataLoader';
import { parseFullMapJson, checkSpatialConflicts, smartMergeEntities, isSceneClean } from './utils/mapParser';

// Import batch operations
import BoxSelection from './components/BoxSelection';
import BatchOperations from './components/BatchOperations';
import { useBatchOperations } from './hooks/useBatchOperations';
import './styles/BatchOperations.css';

// GLTF 组件包装器
const Gltf = ({ src, ...props }) => {
    const { scene } = useGLTF(src);
    return <primitive object={scene.clone()} {...props} />;
};

// 递归渲染层级列表项组件
const LayerItem = ({ 
    obj, 
    allObjects, 
    selectedIds, 
    editingNameId, 
    editingName,
    setEditingName,
    setToolMode, 
    setSelectedId, 
    setSelectedIds,
    startEditingName,
    saveEditingName,
    cancelEditingName,
    updateObject
}) => {
    const [isExpanded, setIsExpanded] = useState(true); // 展开/收起状态
    const isGroup = obj.type === 'group';
    const children = isGroup ? allObjects.filter(child => child.parentId === obj.id) : [];
    
    // 递归计算所有后代对象的数量（排除组合）
    const countDescendants = (parentId) => {
        const directChildren = allObjects.filter(child => child.parentId === parentId);
        let count = directChildren.filter(c => c.type !== 'group').length;
        directChildren.filter(c => c.type === 'group').forEach(group => {
            count += countDescendants(group.id);
        });
        return count;
    };
    
    const actualObjectsCount = isGroup ? countDescendants(obj.id) : 0;
    
    // 调试日志
    if (isGroup && obj.name.includes('组合')) {
        console.log(`🔍 ${obj.name}:`, {
            id: obj.id,
            directChildren: children.length,
            actualObjectsCount: actualObjectsCount,
            children: children.map(c => ({ name: c.name, type: c.type, parentId: c.parentId }))
        });
    }
    
    return (
        <div>
            <div 
                onClick={(e) => {
                    if (!obj.locked) {
                        setToolMode('select');
                        if (e.shiftKey) {
                            // Shift+点击：多选模式，只选中对象本身（不包含子对象）
                            const newIds = selectedIds.includes(obj.id) 
                                ? selectedIds.filter(id => id !== obj.id) 
                                : [...selectedIds, obj.id];
                            setSelectedIds(newIds);
                            setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                        } else {
                            // 普通点击：选中对象及其所有子对象
                            if (isGroup) {
                                const groupAndChildren = [obj.id, ...children.map(c => c.id)];
                                setSelectedIds(groupAndChildren);
                                setSelectedId(obj.id);
                            } else {
                                setSelectedId(obj.id);
                                setSelectedIds([obj.id]);
                            }
                        }
                    }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!obj.locked) {
                        startEditingName(obj.id, obj.name);
                    }
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px] transition-colors ${
                    selectedIds.includes(obj.id) 
                        ? 'bg-blue-900/30 text-blue-100 border-l-2 border-blue-500' 
                        : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300 border-l-2 border-transparent'
                } ${obj.locked ? 'opacity-50' : ''}`}
            >
                {/* 展开/收起按钮 - 仅对组显示 */}
                {isGroup && children.length > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className="min-w-[16px] flex justify-center hover:text-white p-0.5 rounded hover:bg-[#333]"
                        title={isExpanded ? "收起" : "展开"}
                    >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                )}
                
                <div className="min-w-[16px] flex justify-center">
                    {obj.isBaseMap ? (
                        <Map size={12} className="text-blue-400" />
                    ) : isGroup ? (
                        <Layers size={12} className="text-purple-400" />
                    ) : obj.type.includes('wall') ? (
                        <BrickWall size={12} />
                    ) : obj.type === 'floor' ? (
                        <LandPlot size={12} />
                    ) : (
                        <BoxIcon size={12} />
                    )}
                </div>
                {editingNameId === obj.id ? (
                    <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveEditingName}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                                saveEditingName();
                            } else if (e.key === 'Escape') {
                                cancelEditingName();
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="flex-1 bg-[#1a1a1a] border border-blue-500 rounded px-1 py-0.5 text-white outline-none"
                    />
                ) : (
                    <span className="truncate flex-1">{obj.name}</span>
                )}
                {isGroup && (
                    <span className="text-[9px] text-gray-600">({actualObjectsCount})</span>
                )}
                {!obj.isBaseMap && (
                    <>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                updateObject(obj.id, 'locked', !obj.locked); 
                            }} 
                            className="hover:text-white p-1 rounded hover:bg-[#333]" 
                            title={obj.locked ? "解锁" : "锁定"}
                        >
                            {obj.locked ? <Lock size={10} /> : <Unlock size={10} />}
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                updateObject(obj.id, 'visible', !obj.visible); 
                            }} 
                            className="hover:text-white p-1 rounded hover:bg-[#333]"
                        >
                            {obj.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                        </button>
                    </>
                )}
            </div>
            
            {/* 子对象列表 - 只在展开时显示 */}
            {isGroup && children.length > 0 && isExpanded && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-gray-600 pl-3">
                    {children.map(child => (
                        <LayerItem
                            key={child.id}
                            obj={child}
                            allObjects={allObjects}
                            selectedIds={selectedIds}
                            editingNameId={editingNameId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            setToolMode={setToolMode}
                            setSelectedId={setSelectedId}
                            setSelectedIds={setSelectedIds}
                            startEditingName={startEditingName}
                            saveEditingName={saveEditingName}
                            cancelEditingName={cancelEditingName}
                            updateObject={updateObject}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Components for New Data Models ---
const PathRenderer = ({ path, objects, isSelected }) => {
    const source = objects.find(o => o.id === path.sourceId);
    const target = objects.find(o => o.id === path.targetId);

    if (!source || !target) return null;

    const start = new THREE.Vector3(...source.position);
    const end = new THREE.Vector3(...target.position);

    // Lift paths slightly off ground to avoid z-fighting
    start.y = 0.05;
    end.y = 0.05;

    return (
        <group>
            <Line
                points={[start, end]}
                color={isSelected ? "#3b82f6" : "#10b981"} // Blue if selected, Green otherwise
                lineWidth={3}
                dashed={false}
            />
            {/* Optional: Add direction indicators or width visualization here */}
        </group>
    );
};

// Base Map Renderer (SLAM Map)
const BaseMapRenderer = ({ baseMap }) => {
    const [texture, setTexture] = useState(null);

    useEffect(() => {
        if (baseMap.textureUrl) {
            const loader = new THREE.TextureLoader();
            loader.load(
                baseMap.textureUrl,
                (loadedTexture) => {
                    loadedTexture.anisotropy = 16; // Improve texture quality
                    loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
                    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
                    setTexture(loadedTexture);
                },
                undefined,
                (error) => {
                    console.error('Error loading SLAM texture:', error);
                }
            );
        }
    }, [baseMap.textureUrl]);

    return (
        <mesh
            position={baseMap.position}
            rotation={[-Math.PI / 2, 0, 0]} // Rotate to lie flat
            receiveShadow
        >
            <planeGeometry args={[baseMap.scale[0], baseMap.scale[1]]} />
            <meshStandardMaterial
                map={texture}
                color={texture ? '#ffffff' : baseMap.color}
                roughness={0.8}
                metalness={0.2}
            />
        </mesh>
    );
};

// 3D Components (保持不变)
const ContinuousCurveMesh = ({ points, thickness = 0.2, height = 3, tension = 0.5, closed = false, color, opacity, isSelected, hovered }) => {
    const geometry = useMemo(() => createContinuousCurveGeometry(points, thickness, height, tension, closed), [points, thickness, height, tension, closed]);
    if (!geometry) return null;
    return (<mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.5} metalness={0.1} transparent={opacity < 1} opacity={opacity} emissive={isSelected ? '#444' : (hovered ? '#222' : '#000')} side={THREE.DoubleSide} />{(isSelected || hovered) && <Edges threshold={20} scale={1} color={isSelected ? "#60a5fa" : "#ffffff"} geometry={geometry} />}</mesh>);
};
const PolygonFloorMesh = ({ points, color, opacity, isSelected, hovered }) => {
    const geometry = useMemo(() => {
        if (!points || points.length < 3) return new THREE.BufferGeometry();
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].z);
        shape.closePath();
        const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
        geom.rotateX(Math.PI / 2);
        return geom;
    }, [points]);
    return (<mesh geometry={geometry} receiveShadow><meshStandardMaterial color={color} roughness={0.8} metalness={0.1} transparent={opacity < 1} opacity={opacity} emissive={isSelected ? '#444' : (hovered ? '#222' : '#000')} side={THREE.DoubleSide} />{(isSelected || hovered) && <Edges threshold={20} scale={1} color={isSelected ? "#60a5fa" : "#ffffff"} geometry={geometry} />}</mesh>);
};
const PreviewWall = ({ start, end }) => {
    const { pos, rot, len } = useMemo(() => {
        const dx = end.x - start.x; const dz = end.z - start.z; const len = Math.sqrt(dx * dx + dz * dz); const angle = -Math.atan2(dz, dx);
        return { pos: [(start.x + end.x) / 2, 1.5, (start.z + end.z) / 2], rot: [0, angle, 0], len };
    }, [start, end]);
    if (len < 0.1) return null;
    return <mesh position={pos} rotation={rot} scale={[len, 3, 0.2]}><boxGeometry /><meshStandardMaterial color="#3b82f6" transparent opacity={0.4} /></mesh>;
};
const GuideLine = ({ start, end, color = "white" }) => {
    const geometry = useMemo(() => { const points = [new THREE.Vector3(start.x, 0.1, start.z), new THREE.Vector3(end.x, 0.1, end.z)]; return new THREE.BufferGeometry().setFromPoints(points); }, [start, end]);
    return <line geometry={geometry}><lineBasicMaterial color={color} /></line>;
};
const DraggablePoint = ({ position, onDrag, onDragEnd }) => {
    const [hovered, setHovered] = useState(false); const [dragging, setDragging] = useState(false); useCursor(hovered, 'grab', 'grabbing'); const { camera, raycaster, gl } = useThree(); const meshRef = useRef();
    const onPointerDown = (e) => { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); setDragging(true); };
    const onPointerUp = (e) => { e.stopPropagation(); e.target.releasePointerCapture(e.pointerId); setDragging(false); if (onDragEnd) onDragEnd(); };
    const onPointerMove = (e) => { if (!dragging) return; e.stopPropagation(); const worldPos = new THREE.Vector3(); meshRef.current.getWorldPosition(worldPos); const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldPos); const rect = gl.domElement.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; const y = -((e.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera({ x, y }, camera); const intersectPoint = new THREE.Vector3(); raycaster.ray.intersectPlane(dragPlane, intersectPoint); if (intersectPoint) { const localPoint = meshRef.current.parent.worldToLocal(intersectPoint); onDrag({ x: snapToGrid(localPoint.x), y: 0, z: snapToGrid(localPoint.z) }); } };
    return (<mesh ref={meshRef} position={[position.x, 1.5, position.z]} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }} onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove}><sphereGeometry args={[0.3, 16, 16]} /><meshBasicMaterial color={hovered || dragging ? "#ffff00" : "#3b82f6"} depthTest={false} /><Edges color="#000" /></mesh>);
};
const CurveEditor = ({ points, onUpdatePoint, onDragEnd, onAddPoint }) => {
    const linePoints = useMemo(() => points.map(p => [p.x, 0.05, p.z]), [points]);
    const { camera, gl } = useThree();

    // 调试：输出点位信息
    useEffect(() => {
        console.log('CurveEditor points:', points);
    }, [points]);

    // 添加新点的功能 - 需要按住 Shift 键
    useEffect(() => {
        if (!onAddPoint) return;

        const handleClick = (e) => {
            // 只在按住 Shift 键且左键点击时添加点
            if (!e.shiftKey || e.button !== 0) return;

            const raycaster = new THREE.Raycaster();
            const rect = gl.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera({ x, y }, camera);

            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, target);

            if (target) {
                const newPoint = { x: snapToGrid(target.x), y: 0, z: snapToGrid(target.z) };
                onAddPoint(newPoint);
            }
        };

        gl.domElement.addEventListener('click', handleClick);
        return () => gl.domElement.removeEventListener('click', handleClick);
    }, [camera, gl, onAddPoint]);

    return (
        <group>
            {points.map((p, index) => (
                <DraggablePoint
                    key={index}
                    position={p}
                    onDrag={(newPos) => onUpdatePoint(index, newPos)}
                    onDragEnd={onDragEnd}
                />
            ))}
            <Line points={linePoints} color="#60a5fa" opacity={0.4} transparent dashed dashScale={2} dashSize={1} gapSize={1} />
        </group>
    );
};

// 简单的连续直墙预览组件
const StraightWallPreview = ({ points, color = "#3b82f6", opacity = 0.5 }) => {
    if (!points || points.length < 2) return null;

    return (
        <group>
            {points.slice(0, -1).map((point, i) => {
                const start = point;
                const end = points[i + 1];
                const dx = end.x - start.x;
                const dz = end.z - start.z;
                const length = Math.sqrt(dx * dx + dz * dz);

                if (length < 0.01) return null;

                const angle = -Math.atan2(dz, dx);
                const centerX = (start.x + end.x) / 2;
                const centerZ = (start.z + end.z) / 2;

                return (
                    <mesh
                        key={i}
                        position={[centerX, 1.5, centerZ]}
                        rotation={[0, angle, 0]}
                        scale={[length, 3, 0.2]}
                    >
                        <boxGeometry args={[1, 1, 1]} />
                        <meshBasicMaterial
                            color={color}
                            opacity={opacity}
                            transparent
                            depthTest={false}
                        />
                    </mesh>
                );
            })}
        </group>
    );
};

// --- 核心逻辑组件 ---
const AdvancedDrawingManager = ({ mode, onFinish, enableSnap }) => {
    const { camera, gl } = useThree();
    const [points, setPoints] = useState([]);
    const [mousePos, setMousePos] = useState(null);
    const [isSnapped, setIsSnapped] = useState(false);

    useEffect(() => {
        const handleMove = (e) => {
            if (!mode) return;

            // 1. 基础射线检测：获取鼠标在地面上的原始位置
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, target);

            if (target) {
                // --- 核心修改逻辑 ---
                // 判断当前是否需要吸附
                // 逻辑：如果开关开了，且没按Alt -> 吸附
                //       如果开关关了，且没按Alt -> 不吸附
                //       按住Alt -> 反转当前状态
                const shouldSnap = e.altKey ? !enableSnap : enableSnap;

                let bestPos;
                let snapped = false;

                if (shouldSnap) {
                    // 🟢 吸附模式：对齐网格 (Grid Snap)
                    bestPos = {
                        x: snapToGrid(target.x),
                        y: 0,
                        z: snapToGrid(target.z)
                    };

                    // 对象吸附逻辑 (Object Snap)
                    const objects = window.__editorObjects || [];
                    const SNAP_THRESHOLD = 0.5;
                    let minDistance = SNAP_THRESHOLD;

                    objects.forEach(obj => {
                        if (obj.isBaseMap || obj.visible === false) return;

                        // 点吸附检测
                        const pointsToCheck = [];
                        if (obj.position && Array.isArray(obj.position)) {
                            pointsToCheck.push(new THREE.Vector3(obj.position[0], 0, obj.position[2]));
                        }
                        if (obj.points && Array.isArray(obj.points)) {
                            obj.points.forEach(p => {
                                const wx = p.x + (obj.position ? obj.position[0] : 0);
                                const wz = p.z + (obj.position ? obj.position[2] : 0);
                                pointsToCheck.push(new THREE.Vector3(wx, 0, wz));
                            });
                        }

                        pointsToCheck.forEach(pt => {
                            const dist = target.distanceTo(pt);
                            if (dist < minDistance) {
                                minDistance = dist;
                                bestPos = { x: pt.x, y: 0, z: pt.z };
                                snapped = true;
                            }
                        });

                        // 线吸附检测
                        if (obj.points && Array.isArray(obj.points) && obj.points.length >= 2) {
                            for (let i = 0; i < obj.points.length - 1; i++) {
                                const p1 = obj.points[i];
                                const p2 = obj.points[i + 1];
                                const v1 = new THREE.Vector3(
                                    p1.x + (obj.position ? obj.position[0] : 0),
                                    0,
                                    p1.z + (obj.position ? obj.position[2] : 0)
                                );
                                const v2 = new THREE.Vector3(
                                    p2.x + (obj.position ? obj.position[0] : 0),
                                    0,
                                    p2.z + (obj.position ? obj.position[2] : 0)
                                );
                                const line = new THREE.Line3(v1, v2);
                                const closest = new THREE.Vector3();
                                line.closestPointToPoint(target, true, closest);
                                const dist = target.distanceTo(closest);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    bestPos = { x: closest.x, y: 0, z: closest.z };
                                    snapped = true;
                                }
                            }
                        }
                    });

                } else {
                    // ⚪ 自由模式：完全跟随鼠标 (Free Mode)
                    // 专门用于描图，精确度极高
                    bestPos = { x: target.x, y: 0, z: target.z };
                }

                setMousePos(bestPos);
                setIsSnapped(snapped);
            }
        };
        const handleClick = (e) => { if (!mode || !mousePos) return; if (e.button !== 0) return; e.stopPropagation(); if (mode === 'draw_wall' || mode === 'draw_curve' || mode === 'draw_floor') { if (points.length > 0) { const last = points[points.length - 1]; if (Math.abs(mousePos.x - last.x) < 0.1 && Math.abs(mousePos.z - last.z) < 0.1) return; } setPoints([...points, mousePos]); } };
        const handleKeyDown = (e) => { if (!mode) return; if (e.key === 'Enter') { if (mode === 'draw_curve' && points.length >= 2) { onFinish({ type: 'curved_wall', points }); setPoints([]); } else if (mode === 'draw_floor' && points.length >= 3) { onFinish({ type: 'polygon_floor', points }); setPoints([]); } else if (mode === 'draw_wall' && points.length >= 2) { onFinish({ type: 'wall_path', points }); setPoints([]); } } if (e.key === 'Escape') setPoints([]); };
        const handleRightClick = (e) => { if (mode) { e.preventDefault(); if (mode === 'draw_curve' && points.length >= 2) { onFinish({ type: 'curved_wall', points }); setPoints([]); } else if (mode === 'draw_floor' && points.length >= 3) { onFinish({ type: 'polygon_floor', points }); setPoints([]); } else if (mode === 'draw_wall' && points.length >= 2) { onFinish({ type: 'wall_path', points }); setPoints([]); } else { setPoints([]); } } };
        if (mode) { gl.domElement.addEventListener('pointermove', handleMove); gl.domElement.addEventListener('click', handleClick); gl.domElement.addEventListener('contextmenu', handleRightClick); window.addEventListener('keydown', handleKeyDown); }
        return () => { gl.domElement.removeEventListener('pointermove', handleMove); gl.domElement.removeEventListener('click', handleClick); gl.domElement.removeEventListener('contextmenu', handleRightClick); window.removeEventListener('keydown', handleKeyDown); };
    }, [mode, camera, gl, points, mousePos, onFinish, enableSnap]);

    const previewLinePoints = useMemo(() => { if (!mousePos || points.length === 0) return null; return [...points, mousePos].map(p => [p.x, 0.1, p.z]); }, [points, mousePos]);
    if (!mode || !mousePos) return null;

    return (
        <group>
            <mesh position={[mousePos.x, 0.2, mousePos.z]} renderOrder={200}>
                <ringGeometry args={[0.1, 0.15, 32]} />
                <meshBasicMaterial
                    color={!enableSnap ? "#f97316" : (isSnapped ? "#4ade80" : "#3b82f6")}
                    depthTest={false}
                    transparent
                    opacity={0.8}
                />
            </mesh>
            {points.map((p, i) => (<mesh key={i} position={[p.x, 0.2, p.z]} renderOrder={200}><sphereGeometry args={[0.1]} /><meshBasicMaterial color="white" depthTest={false} /></mesh>))}
            {/* Preview Lines */}
            {points.length > 0 && <Line points={previewLinePoints} color="#3b82f6" lineWidth={2} dashed />}
            {/* Existing geometries */}
            {mode === 'draw_curve' && points.length >= 1 && <ContinuousCurveMesh points={[...points, mousePos]} thickness={0.2} height={3} tension={0.5} color="#3b82f6" opacity={0.5} />}
            {mode === 'draw_floor' && points.length >= 2 && <PolygonFloorMesh points={[...points, mousePos]} color="#3b82f6" opacity={0.3} />}
            {/* Wall preview - 使用简单的矩形墙段预览 */}
            {mode === 'draw_wall' && points.length >= 1 && <StraightWallPreview points={[...points, mousePos]} color="#3b82f6" opacity={0.5} />}
        </group>
    );
};

const PathCreationManager = ({ toolMode, objects, onAddPoint, onAddPath }) => {
    const { gl, camera, scene } = useThree();
    const [startPointId, setStartPointId] = useState(null);
    const [mousePos, setMousePos] = useState(null);

    useEffect(() => {
        if (toolMode !== 'draw_path') {
            setStartPointId(null);
            setMousePos(null);
            return;
        }

        const handleMove = (e) => {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, target);
            if (target) setMousePos(target);
        };

        const handleClick = (e) => {
            if (e.button !== 0) return; // Left click only

            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(
                (e.clientX / window.innerWidth) * 2 - 1,
                -(e.clientY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);

            // Check intersections with Points
            // We filter scene children to find our points
            const pointMeshes = [];
            scene.traverse(child => {
                if (child.parent && objects.find(o => o.id === child.parent.name && o.type === 'point')) {
                    pointMeshes.push(child);
                }
            });

            const intersects = raycaster.intersectObjects(pointMeshes, true);

            if (intersects.length > 0) {
                // Clicked on a Point
                const hitObj = intersects[0].object;
                const pointId = hitObj.parent.name; // Assuming group name is ID

                e.stopPropagation();

                if (!startPointId) {
                    setStartPointId(pointId);
                } else {
                    if (pointId !== startPointId) {
                        onAddPath(startPointId, pointId);
                        setStartPointId(null); // Reset to allow new path
                    }
                }
            } else {
                // Clicked on empty space -> Create Point
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const target = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, target);

                if (target) {
                    const newPoint = createPoint({ x: snapToGrid(target.x), y: 0, z: snapToGrid(target.z) });
                    onAddPoint(newPoint);
                    // If we had a start point, connect to this new point?
                    // Let's keep it simple: just create point. User can click again to connect.
                }
            }
        };

        gl.domElement.addEventListener('pointermove', handleMove);
        gl.domElement.addEventListener('click', handleClick);
        return () => {
            gl.domElement.removeEventListener('pointermove', handleMove);
            gl.domElement.removeEventListener('click', handleClick);
        };
    }, [toolMode, startPointId, objects, onAddPoint, onAddPath, gl, camera, scene]);

    // Visual Feedback
    if (toolMode !== 'draw_path' || !startPointId || !mousePos) return null;

    const startObj = objects.find(o => o.id === startPointId);
    if (!startObj) return null;

    return (
        <Line
            points={[[startObj.position[0], 0.1, startObj.position[2]], [mousePos.x, 0.1, mousePos.z]]}
            color="#3b82f6"
            lineWidth={2}
            dashed
        />
    );
};
// OrbitControls with drag detection to prevent accidental selection
const OrbitControlsWithDragDetection = React.forwardRef((props, ref) => {
    const controlsRef = useRef();
    const isDraggingRef = useRef(false);
    const { gl, camera } = useThree();

    // Merge refs
    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(controlsRef.current);
            } else {
                ref.current = controlsRef.current;
            }
        }
    }, [ref]);

    useEffect(() => {
        if (!controlsRef.current) return;

        const controls = controlsRef.current;

        const onStart = () => {
            isDraggingRef.current = false;
        };

        const onChange = () => {
            isDraggingRef.current = true;
        };

        const onEnd = () => {
            // Prevent click event if we were dragging
            if (isDraggingRef.current) {
                // Add a temporary flag to prevent the next click
                const preventClick = (e) => {
                    e.stopPropagation();
                    gl.domElement.removeEventListener('click', preventClick, true);
                };
                gl.domElement.addEventListener('click', preventClick, true);
            }
            // Reset after a short delay
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        controls.addEventListener('start', onStart);
        controls.addEventListener('change', onChange);
        controls.addEventListener('end', onEnd);

        return () => {
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('change', onChange);
            controls.removeEventListener('end', onEnd);
        };
    }, [gl]);

    // Key listeners for advanced controls
    const [mouseButtons, setMouseButtons] = useState({
        LEFT: null, // Default: Selection
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    });

    useEffect(() => {
        const keyState = { space: false, alt: false };

        const updateMouseButtons = () => {
            console.log('🎮 Updating mouse buttons:', keyState);
            if (keyState.alt) {
                console.log('🔄 Setting LEFT to ROTATE');
                setMouseButtons({ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN });
                gl.domElement.style.cursor = 'all-scroll';
            } else if (keyState.space) {
                console.log('🖐️ Setting LEFT to PAN');
                setMouseButtons({ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN });
                gl.domElement.style.cursor = 'grab';
            } else {
                console.log('🖱️ Setting LEFT to null (selection mode)');
                setMouseButtons({ LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN });
                gl.domElement.style.cursor = 'auto';
            }
        };

        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent page scroll
                keyState.space = true;
            }
            // Support both Mac (Option/Alt) and Windows (Alt)
            if (e.altKey || e.key === 'Alt') {
                keyState.alt = true;
            }
            updateMouseButtons();
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                keyState.space = false;
            }
            // Check if Alt is still pressed
            if (!e.altKey && (e.key === 'Alt')) {
                keyState.alt = false;
            }
            updateMouseButtons();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gl]);

    // Update OrbitControls.mouseButtons directly when state changes
    useEffect(() => {
        if (controlsRef.current) {
            console.log('🔧 Directly updating OrbitControls.mouseButtons:', mouseButtons);
            // Only set defined values
            const buttons = {};
            if (mouseButtons.LEFT !== null && mouseButtons.LEFT !== undefined) {
                buttons.LEFT = mouseButtons.LEFT;
            }
            if (mouseButtons.MIDDLE !== null && mouseButtons.MIDDLE !== undefined) {
                buttons.MIDDLE = mouseButtons.MIDDLE;
            }
            if (mouseButtons.RIGHT !== null && mouseButtons.RIGHT !== undefined) {
                buttons.RIGHT = mouseButtons.RIGHT;
            }
            controlsRef.current.mouseButtons = buttons;
        }
    }, [mouseButtons]);

    return <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={true}
        enableRotate={true}
        enableZoom={true}
        {...props}
    />;
});

const DragDropManager = ({ onDrop }) => {
    const { camera, gl } = useThree();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const intersectPoint = new THREE.Vector3();
    useEffect(() => {
        const handleDragOver = (e) => e.preventDefault();
        const handleDrop = (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            const assetId = e.dataTransfer.getData('assetId');
            if (!type) return;
            const rect = gl.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, intersectPoint);
            onDrop(type, [intersectPoint.x, 0, intersectPoint.z], assetId);
        };
        const canvas = gl.domElement;
        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('drop', handleDrop);
        return () => { canvas.removeEventListener('dragover', handleDragOver); canvas.removeEventListener('drop', handleDrop); };
    }, [camera, gl, onDrop]);
    return null;
};

// 2D 交互对象组件
const Interactive2DObject = ({ obj, isSelected, transformMode, toolMode, onSelect, onTransformEnd, cameraView }) => {
    const groupRef = useRef();

    // 如果对象是基础地图或被锁定，不允许选择和变换
    if (obj.isBaseMap || obj.locked) {
        return null;
    }

    return (
        <group>
            <group
                ref={groupRef}
                name={obj.id}
                position={obj.position}
                rotation={[0, obj.rotation[1], 0]}
                scale={obj.scale}
            >
                <mesh
                    onClick={(e) => { e.stopPropagation(); if (!obj.locked) onSelect(obj.id, e.shiftKey, e.ctrlKey || e.metaKey); }}
                    position={[0, 0.05, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial visible={false} />
                </mesh>
            </group>

            {/* 2D模式下的变换控制器 - 选中时默认显示移动箭头 */}
            {isSelected && toolMode === 'select' && (() => {
                // 根据视图模式决定显示哪些轴
                const axisConfig = {
                    top: { showX: true, showY: false, showZ: true },      // 俯视图：XZ平面
                    front: { showX: true, showY: true, showZ: false },    // 正视图：XY平面
                    perspective: { showX: true, showY: true, showZ: true } // 透视图：全部显示
                };
                const { showX, showY, showZ } = axisConfig[cameraView] || axisConfig.perspective;
                
                return (
                    <TransformControls
                        object={groupRef}
                        mode={transformMode || 'translate'}
                        size={0.8}
                        showX={showX}
                        showY={showY}
                        showZ={showZ}
                        translationSnap={enableSnap ? 1 : null}
                        rotationSnap={enableSnap ? THREE.MathUtils.degToRad(15) : null}
                    onMouseUp={() => {
                        if (groupRef.current) {
                            const { position, rotation, scale } = groupRef.current;
                            onTransformEnd(obj.id, {
                                position: [position.x, position.y, position.z],
                                rotation: [rotation.x, rotation.y, rotation.z],
                                scale: [scale.x, scale.y, scale.z]
                            });
                        }
                    }}
                />
                );
            })()}
        </group>
    );
};

// 无限网格线组件（类似Blender）
const InfiniteGrid = () => {
    return (
        <>
            {/* 使用drei的Grid组件，支持无限网格 */}
            <Grid
                position={[0, 0, 0]}
                args={[100, 100]}
                cellSize={1}
                cellThickness={0.6}
                cellColor="#3a3a3a"
                sectionSize={10}
                sectionThickness={1.2}
                sectionColor="#4a4a4a"
                fadeDistance={150}
                fadeStrength={1}
                infiniteGrid={true}
            />

            {/* X轴（红色） */}
            <Line
                points={[[-1000, 0, 0], [1000, 0, 0]]}
                color="#dd5555"
                lineWidth={2.5}
            />

            {/* Z轴（蓝色） */}
            <Line
                points={[[0, 0, -1000], [0, 0, 1000]]}
                color="#5577dd"
                lineWidth={2.5}
            />
        </>
    );
};

// 2D 坐标轴组件
const CoordinateAxes = () => {
    return (
        <group>
            {/* 原点标注 */}
            <Html position={[0, 0.1, 0]} center>
                <div className="bg-white/90 px-2 py-1 rounded text-[10px] font-mono text-gray-700 border border-gray-300 pointer-events-none">
                    (0,0)
                </div>
            </Html>

            {/* 原点圆圈 */}
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.4, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* Y轴（绿色向上） */}
            <Line
                points={[[0, 0.05, 0], [0, 0.05, 3]]}
                color="#22c55e"
                lineWidth={3}
            />
            <mesh position={[0, 0.05, 3.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.15, 0.4, 8]} />
                <meshBasicMaterial color="#22c55e" />
            </mesh>

            {/* X轴（红色向右） */}
            <Line
                points={[[0, 0.05, 0], [3, 0.05, 0]]}
                color="#ef4444"
                lineWidth={3}
            />
            <mesh position={[3.3, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.15, 0.4, 8]} />
                <meshBasicMaterial color="#ef4444" />
            </mesh>
        </group>
    );
};

// 2D 场景渲染器（已隐藏）
const Scene2DRenderer = ({ objects, selectedId, selectedIds, viewMode, transformMode, onTransformEnd, onSelect }) => {
    return null; // 隐藏 2D 环境
    // if (viewMode !== '2d') return null;

    return (
        <group>
            {objects.filter(obj => {
                // 基础过滤：可见且不是组
                if (!obj.visible || obj.type === 'group') return false;

                // 楼层过滤：如果对象有 floorLevel 属性，检查是否匹配当前楼层
                if (obj.floorLevel && currentFloorLevel) {
                    return obj.floorLevel === currentFloorLevel.name;
                }

                // 如果对象没有楼层信息，默认显示（如基础地面、底图等）
                return true;
            }).map(obj => {
                const isSelected = selectedIds ? selectedIds.includes(obj.id) : obj.id === selectedId;

                // Render Points in 2D
                if (obj.type === 'point') {
                    return (
                        <group key={obj.id} name={obj.id} position={[obj.position[0], 0.2, obj.position[2]]}>
                            <mesh onClick={(e) => { e.stopPropagation(); onSelect(obj.id, e.shiftKey); }}>
                                <circleGeometry args={[0.4, 32]} />
                                <meshBasicMaterial color={isSelected ? "#3b82f6" : "#10b981"} />
                            </mesh>
                            <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }}>
                                <div className="text-[10px] text-white bg-black/50 px-1 rounded">{obj.name}</div>
                            </Html>
                        </group>
                    );
                }

                // Render Paths in 2D
                if (obj.type === 'path') {
                    const source = objects.find(o => o.id === obj.sourceId);
                    const target = objects.find(o => o.id === obj.targetId);
                    if (source && target) {
                        return (
                            <Line
                                key={obj.id}
                                points={[[source.position[0], 0.1, source.position[2]], [target.position[0], 0.1, target.position[2]]]}
                                color={isSelected ? "#3b82f6" : "#10b981"}
                                lineWidth={3}
                                onClick={(e) => { e.stopPropagation(); onSelect(obj.id, e.shiftKey); }}
                            />
                        );
                    }
                    return null;
                }

                // 渲染墙体为黑色线条
                if (obj.type === 'curved_wall' && obj.points) {
                    const worldPoints = obj.points.map(p => [
                        p.x + obj.position[0],
                        0.1,
                        p.z + obj.position[2]
                    ]);

                    return (
                        <group
                            key={obj.id}
                            name={obj.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!obj.locked) {
                                    onSelect && onSelect(obj.id, e.shiftKey);
                                }
                            }}
                        >
                            <Line
                                points={worldPoints}
                                color={isSelected ? "#3b82f6" : "#1a1a1a"}
                                lineWidth={isSelected ? 5 : 4}
                            />
                            {/* Invisible tube for easier clicking */}
                            <mesh>
                                <tubeGeometry args={[
                                    new THREE.CatmullRomCurve3(
                                        worldPoints.map(p => new THREE.Vector3(...p))
                                    ),
                                    64, 0.3, 8, false
                                ]} />
                                <meshBasicMaterial visible={false} />
                            </mesh>
                            {/* 端点标记 */}
                            {worldPoints.map((point, idx) => (
                                <mesh key={idx} position={point}>
                                    <circleGeometry args={[0.15, 16]} />
                                    <meshBasicMaterial color={isSelected ? "#3b82f6" : "#1a1a1a"} />
                                </mesh>
                            ))}
                        </group>
                    );
                }

                // 渲染地面为浅灰色填充
                if (obj.type === 'polygon_floor' && obj.points) {
                    const worldPoints = obj.points.map(p => [
                        p.x + obj.position[0],
                        0.05,
                        p.z + obj.position[2]
                    ]);

                    return (
                        <group key={obj.id} name={obj.id}>
                            <Line
                                points={[...worldPoints, worldPoints[0]]}
                                color={isSelected ? "#3b82f6" : "#64748b"}
                                lineWidth={isSelected ? 3 : 2}
                            />
                        </group>
                    );
                }

                // 渲染 waypoint 点位为圆形标记
                if (obj.type === 'waypoint') {
                    const color = obj.poseData?.parkable ? '#4CAF50' :
                        obj.poseData?.dockable ? '#2196F3' : '#FFC107';

                    return (
                        <group key={obj.id} name={obj.id} position={[obj.position[0], 0.1, obj.position[2]]}>
                            <mesh
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!obj.locked) onSelect(obj.id, e.shiftKey);
                                }}
                                onPointerOver={(e) => e.stopPropagation()}
                            >
                                <circleGeometry args={[0.5, 32]} />
                                <meshBasicMaterial
                                    color={isSelected ? "#60a5fa" : color}
                                    opacity={obj.locked ? 0.5 : 0.9}
                                    transparent
                                />
                            </mesh>

                            {/* 方向指示器 */}
                            <mesh
                                position={[0.4, 0.01, 0]}
                                rotation={[0, obj.rotation[1], 0]}
                            >
                                <coneGeometry args={[0.15, 0.3, 3]} />
                                <meshBasicMaterial
                                    color={isSelected ? "#1e40af" : "#1a1a1a"}
                                    opacity={0.8}
                                    transparent
                                />
                            </mesh>

                            {/* 标签 */}
                            <Html position={[0, 0.2, 0.8]} center style={{ pointerEvents: 'none' }}>
                                <div className="bg-black/70 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap">
                                    {obj.name} {obj.locked && '🔒'}
                                </div>
                            </Html>
                        </group>
                    );
                }

                // 渲染路径线为连接线
                if (obj.type === 'path_line' && obj.pathData) {
                    const pathData = obj.pathData;
                    if (pathData.poses && pathData.poses.length >= 2) {
                        const points = pathData.poses.map(pose => [pose.x, 0.08, pose.y]);

                        return (
                            <group key={obj.id} name={obj.id}>
                                <Line
                                    points={points}
                                    color={isSelected ? "#60a5fa" : (pathData.bidirectional ? '#4CAF50' : '#FF9800')}
                                    lineWidth={isSelected ? 4 : 3}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!obj.locked) onSelect(obj.id, e.shiftKey);
                                    }}
                                />

                                {/* 路径方向箭头 */}
                                {!pathData.bidirectional && points.length >= 2 && (
                                    <mesh position={points[Math.floor(points.length / 2)]}>
                                        <coneGeometry args={[0.2, 0.4, 3]} />
                                        <meshBasicMaterial color="#FF9800" opacity={0.8} transparent />
                                    </mesh>
                                )}
                            </group>
                        );
                    }
                }

                // 渲染地图底图 - 使用 MapImage2D 组件来显示纹理
                if (obj.type === 'map_image') {
                    return <MapImage2D key={obj.id} data={obj} isSelected={isSelected} onSelect={onSelect} />;
                }

                // 渲染所有类型的对象为蓝色方块
                if (!obj.points && obj.type !== 'waypoint' && obj.type !== 'path_line' && obj.type !== 'map_image') {
                    const sizeX = obj.scale[0];
                    const sizeZ = obj.scale[2];

                    return (
                        <group key={obj.id} name={obj.id} position={obj.position} rotation={obj.rotation}>
                            {/* 填充矩形 */}
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} pointerEvents="none" renderOrder={obj.isBaseMap ? -10 : 0}>
                                <planeGeometry args={[sizeX, sizeZ]} />
                                <meshBasicMaterial
                                    color={isSelected ? "#60a5fa" : "#3b82f6"}
                                    opacity={obj.locked ? 0.5 : 0.8}
                                    transparent
                                />
                            </mesh>

                            {/* 边框 */}
                            <Line
                                points={[
                                    [-sizeX / 2, 0.06, -sizeZ / 2],
                                    [sizeX / 2, 0.06, -sizeZ / 2],
                                    [sizeX / 2, 0.06, sizeZ / 2],
                                    [-sizeX / 2, 0.06, sizeZ / 2],
                                    [-sizeX / 2, 0.06, -sizeZ / 2]
                                ]}
                                color={isSelected ? "#1e40af" : (obj.locked ? "#6b7280" : "#1e3a8a")}
                                lineWidth={2}
                            />

                            {/* 设备标签 - 移到下方避免遮挡 */}
                            <Html position={[0, 0.1, sizeZ / 2 + 0.8]} center>
                                <div className="bg-white/95 px-2 py-1 rounded text-[11px] font-medium text-gray-800 border border-gray-300 pointer-events-none whitespace-nowrap shadow-sm">
                                    {obj.name} {obj.locked && '🔒'}
                                </div>
                            </Html>
                        </group>
                    );
                }

                return null;
            })}
        </group>
    );
};

// 地图底图组件 (3D模式)
const MapImage = ({ data, isSelected, onSelect }) => {
    const meshRef = useRef();
    const [texture, setTexture] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log('🗺️ MapImage 加载:', data.name, 'imageData:', data.imageData?.substring(0, 50));
        if (data.imageData) {
            setLoading(true);
            const loader = new THREE.TextureLoader();
            loader.load(
                data.imageData,
                (tex) => {
                    console.log('✅ MapImage 纹理加载成功:', data.name);
                    setTexture(tex);
                    setLoading(false);
                },
                undefined,
                (err) => {
                    console.error('❌ MapImage 纹理加载失败:', data.name, err);
                    setLoading(false);
                }
            );
        }
    }, [data.imageData]);

    if (loading) {
        console.log('⏳ MapImage 加载中...', data.name);
    }

    if (!texture) return null;

    return (
        <mesh
            ref={meshRef}
            position={data.position}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => { e.stopPropagation(); if (!data.locked) onSelect(data.id, e.shiftKey, e.ctrlKey || e.metaKey); }}
        >
            <planeGeometry args={[data.scale[0], data.scale[2]]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={data.opacity || 0.8}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

// 地图底图组件 (2D模式 - 专门用于显示SLAM地图)
const MapImage2D = ({ data, isSelected, onSelect }) => {
    const [texture, setTexture] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('🗺️ MapImage2D 渲染:', data.name, 'imageData存在:', !!data.imageData);

        if (data.imageData) {
            console.log('开始加载地图纹理...', data.name);
            console.log('图片数据长度:', data.imageData.length);
            console.log('图片数据前缀:', data.imageData.substring(0, 50));
            setLoading(true);
            setError(null);

            const loader = new THREE.TextureLoader();
            loader.load(
                data.imageData,
                (tex) => {
                    console.log('✅ 地图纹理加载成功!', data.name, tex);
                    setTexture(tex);
                    setLoading(false);
                },
                (progress) => {
                    console.log('加载进度:', progress);
                },
                (err) => {
                    console.error('❌ 地图纹理加载失败:', err);
                    console.error('图片数据前100字符:', data.imageData.substring(0, 100));
                    setError(err.message || '加载失败');
                    setLoading(false);
                }
            );
        } else {
            console.warn('⚠️ 地图对象没有 imageData:', data);
            setError('无图片数据');
        }
    }, [data.imageData, data.name]);

    return (
        <group position={data.position} rotation={data.rotation}>
            <mesh
                position={[0, 0.15, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={100}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!data.locked) onSelect(data.id, e.shiftKey);
                }}
            >
                <planeGeometry args={data.scale} />
                <meshBasicMaterial
                    map={texture}
                    color={texture ? "#ffffff" : (isSelected ? "#bfdbfe" : "#e5e5e5")}
                    opacity={texture ? 0.85 : 0.6}
                    transparent
                    depthTest={false}
                />
            </mesh>

            {/* 边框 */}
            <Line
                points={[
                    [-data.scale[0] / 2, 0.16, -data.scale[2] / 2],
                    [data.scale[0] / 2, 0.16, -data.scale[2] / 2],
                    [data.scale[0] / 2, 0.16, data.scale[2] / 2],
                    [-data.scale[0] / 2, 0.16, data.scale[2] / 2],
                    [-data.scale[0] / 2, 0.16, -data.scale[2] / 2]
                ]}
                color={isSelected ? "#3b82f6" : "#6b7280"}
                lineWidth={isSelected ? 3 : 2}
            />

            {/* 地图标识和状态 */}
            <Html position={[0, 0.2, 0]} center style={{ pointerEvents: 'none' }}>
                <div className={`px-2 py-1 rounded text-[10px] font-medium ${texture ? 'bg-green-600/80 text-white' :
                    loading ? 'bg-blue-600/80 text-white' :
                        'bg-red-600/80 text-white'
                    }`}>
                    {texture ? '✅ ' : (loading ? '⏳ ' : '❌ ')}
                    {data.name || '地图底图'}
                    {loading && ' (加载中...)'}
                    {error && ` (${error})`}
                </div>
            </Html>
        </group>
    );
};

// 点位组件 (Waypoint)
const WaypointMarker = ({ data, isSelected, onSelect }) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    return (
        <group position={data.position} rotation={data.rotation}>
            {/* 点位圆柱 */}
            <mesh
                ref={meshRef}
                onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey, e.ctrlKey || e.metaKey); }}
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
                <meshStandardMaterial color={data.color} />
            </mesh>

            {/* 标签 */}
            {(isSelected || hovered) && (
                <Html position={[0, 0.5, 0]} center distanceFactor={10}>
                    <div className="bg-black/80 backdrop-blur px-2 py-1 rounded text-[10px] text-white border border-blue-500">
                        {data.name}
                    </div>
                </Html>
            )}
        </group>
    );
};

// 路径线组件
const PathLine = ({ data, isSelected, onSelect }) => {
    const points = useMemo(() => {
        if (!data.points || data.points.length < 2) return [];
        return data.points.map(p => new THREE.Vector3(
            p.x + data.position[0],
            data.position[1],
            p.z + data.position[2]
        ));
    }, [data.points, data.position]);

    if (points.length < 2) return null;

    return (
        <Line
            points={points}
            color={isSelected ? '#2196F3' : data.color}
            lineWidth={isSelected ? 3 : 2}
            onClick={(e) => { e.stopPropagation(); onSelect(data.id, e.shiftKey, e.ctrlKey || e.metaKey); }}
        />
    );
};

// 自动缩放的GLB组件 - 完全拉伸模型到地图边界
const AutoScaleGltf = ({ src, data, baseMapData, onScaleCalculated }) => {
    const [model, setModel] = useState(null);
    const [scale, setScale] = useState([1, 1, 1]);
    const [position, setPosition] = useState([0, 0, 0]);
    
    console.log('🔍 AutoScaleGltf 组件渲染:', { src, locked: data.locked, name: data.name, hasBaseMapData: !!baseMapData });
    
    useEffect(() => {
        console.log('🔍 AutoScaleGltf useEffect 触发:', { locked: data.locked, type: data.type, baseMapData });
        
        // 🔑 只对 custom_model 类型的模型自动缩放
        if (data.type !== 'custom_model') {
            console.log('⚠️ 不是 custom_model 类型，跳过自动缩放');
            return;
        }
        
        if (!baseMapData) {
            console.log('⚠️ 没有底图数据，跳过自动缩放');
            return;
        }
        
        console.log('🚀 开始自动拉伸适配...');
        
        const loader = new GLTFLoader();
        
        // 配置DRACO解码器
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(
            src,
            (gltf) => {
                const loadedModel = gltf.scene;
                
                // 步骤1: 完全重置模型变换
                loadedModel.position.set(0, 0, 0);
                loadedModel.rotation.set(0, 0, 0);
                loadedModel.scale.set(1, 1, 1);
                loadedModel.updateMatrixWorld(true);
                
                // 检查baseMapData是否存在
                if (!baseMapData || !baseMapData.actualSize) {
                    console.warn('⚠️ 没有底图数据，跳过自动缩放');
                    setModel(loadedModel);
                    return;
                }
                
                // 从传入的baseMapData获取底图尺寸和原点
                const mapWidth = baseMapData.actualSize.width * baseMapData.resolution;
                const mapHeight = baseMapData.actualSize.height * baseMapData.resolution;
                const mapOrigin = baseMapData.origin;
                
                if (mapWidth > 0 && mapHeight > 0) {
                    console.log('🚀 开始自动拉伸适配...');
                    console.log('📏 地图尺寸:', mapWidth.toFixed(2), 'x', mapHeight.toFixed(2), '米');
                    console.log('📍 地图原点:', mapOrigin);
                    console.log('📍 地图居中在世界坐标 (0, 0, 0)');
                    
                    // 步骤2: 计算模型原始边界
                    const modelBox = new THREE.Box3().setFromObject(loadedModel);
                    const modelSize = modelBox.getSize(new THREE.Vector3());
                    
                    console.log('📦 模型原始尺寸:', modelSize.x.toFixed(2), 'x', modelSize.y.toFixed(2), 'x', modelSize.z.toFixed(2));
                    
                    // 步骤3: 计算独立的缩放比例（XZ拉伸撑满，Y保持比例）
                    const scaleX = mapWidth / modelSize.x;
                    const scaleZ = mapHeight / modelSize.z;
                    const scaleY = scaleX; // Y轴使用X轴的缩放，保持建筑高度比例
                    
                    console.log('🔧 计算缩放比例:', scaleX.toFixed(4), ',', scaleY.toFixed(4), ',', scaleZ.toFixed(4));
                    console.log('   - 注意：X和Z独立缩放以撑满地图，Y使用X的缩放保持比例');
                    
                    // 步骤4: 应用缩放
                    loadedModel.scale.set(scaleX, scaleY, scaleZ);
                    loadedModel.updateMatrixWorld(true);
                    
                    // 步骤5: 重新计算缩放后的边界
                    const scaledBox = new THREE.Box3().setFromObject(loadedModel);
                    
                    // 步骤6: 计算对齐偏移（让模型对齐到地图左下角）
                    // 🔑 底图现在居中在(0,0,0)，所以地图左下角是(-mapWidth/2, -mapHeight/2)
                    const mapMinX = -mapWidth / 2;
                    const mapMinZ = -mapHeight / 2;
                    
                    const offsetX = mapMinX - scaledBox.min.x;
                    const offsetY = -scaledBox.min.y; // 让模型底部贴在Y=0平面
                    const offsetZ = mapMinZ - scaledBox.min.z;
                    
                    console.log('📍 计算偏移量:', offsetX.toFixed(2), ',', offsetY.toFixed(2), ',', offsetZ.toFixed(2));
                    
                    // 🔑 直接应用到模型上，而不是通过state
                    loadedModel.position.set(offsetX, offsetY, offsetZ);
                    
                    console.log('✅ 自动拉伸适配完成！');
                    console.log('最终模型状态:', {
                        scale: [scaleX, scaleY, scaleZ],
                        position: [offsetX, offsetY, offsetZ]
                    });
                    
                    // 🔑 回调通知父组件更新scale
                    if (onScaleCalculated) {
                        onScaleCalculated({
                            scale: [scaleX, scaleY, scaleZ],
                            position: [offsetX, offsetY, offsetZ]
                        });
                    }
                }
                
                setModel(loadedModel);
            },
            undefined,
            (error) => {
                console.error('❌ GLB模型加载失败:', error);
            }
        );
    }, [src]); // 🔑 只在src变化时重新加载模型
    
    if (!model) {
        return (
            <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="gray" wireframe />
            </mesh>
        );
    }
    
    // 🔑 直接返回primitive，scale和position已经在useEffect中应用到model上了
    return <primitive object={model} />;
};

// 场景对象
const SceneObject = ({ data, baseMapData, isSelected, isEditingPoints, onSelect, transformMode, onTransformEnd, onUpdatePoints, onToggleEdit, cameraView, enableSnap }) => {
    const groupRef = useRef(); const [hovered, setHovered] = useState(false); useCursor(hovered && !isSelected && !isEditingPoints);

    // 调试：输出3D场景模型信息
    useEffect(() => {
        if (data.type === 'custom_model') {
            console.log('🏗️ 渲染GLB模型:', {
                name: data.name,
                type: data.type,
                visible: data.visible,
                modelUrl: data.modelUrl,
                position: data.position,
                scale: data.scale,
                hasBaseMapData: !!baseMapData,
                baseMapData: baseMapData ? {
                    hasActualSize: !!baseMapData.actualSize,
                    hasResolution: !!baseMapData.resolution,
                    hasOrigin: !!baseMapData.origin
                } : null
            });
        }
    }, [data, baseMapData]);

    if (!data.visible) return null; const isFloorType = data.type === 'floor' || data.type === 'polygon_floor';

    // 调试：输出编辑状态
    useEffect(() => {
        if (data.type === 'curved_wall' && isSelected) {
            console.log('SceneObject - curved_wall:', {
                id: data.id,
                isSelected,
                isEditingPoints,
                hasPoints: !!data.points,
                pointsLength: data.points?.length
            });
        }
    }, [data.type, data.id, isSelected, isEditingPoints, data.points]);
    return (
        <>
            <group ref={groupRef} name={data.id} position={data.position} rotation={data.rotation} scale={data.locked ? [1, 1, 1] : data.scale} onClick={(e) => { e.stopPropagation(); if (!(data.type === 'custom_model' && data.locked)) { onSelect(data.id, e.shiftKey, e.ctrlKey || e.metaKey); } }} onDoubleClick={(e) => { e.stopPropagation(); if (!(data.type === 'custom_model' && data.locked) && onToggleEdit) { onToggleEdit(data.id); } }} onPointerOver={(e) => { e.stopPropagation(); if (!(data.type === 'custom_model' && data.locked) && !isSelected) { setHovered(true); } }} onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>
                {data.type === 'curved_wall' ? (<><ContinuousCurveMesh points={data.points} thickness={data.thickness || 0.2} height={data.height || 3} tension={data.tension !== undefined ? data.tension : 0.5} closed={data.closed} color={data.color} opacity={data.opacity || 1} isSelected={isSelected} hovered={hovered && !isSelected} />{isSelected && isEditingPoints && (<CurveEditor points={data.points} onUpdatePoint={(idx, newPos) => { const newPoints = [...data.points]; newPoints[idx] = newPos; onUpdatePoints(data.id, newPoints, false); }} onDragEnd={() => { onUpdatePoints(data.id, data.points, true); }} onAddPoint={(newPoint) => { const newPoints = [...data.points, newPoint]; onUpdatePoints(data.id, newPoints, true); }} />)}</>) : data.type === 'polygon_floor' ? (<><PolygonFloorMesh points={data.points} color={data.color} opacity={data.opacity || 1} isSelected={isSelected} hovered={hovered && !isSelected} />{isSelected && isEditingPoints && (<CurveEditor points={data.points} onUpdatePoint={(idx, newPos) => { const newPoints = [...data.points]; newPoints[idx] = newPos; onUpdatePoints(data.id, newPoints, false); }} onDragEnd={() => { onUpdatePoints(data.id, newPoints, true); }} onAddPoint={(newPoint) => { const newPoints = [...data.points, newPoint]; onUpdatePoints(data.id, newPoints, true); }} />)}</>) : (
                    <React.Fragment>
                        {data.modelUrl ? (<Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="gray" wireframe /></mesh>}>{data.type === 'custom_model' ? (<AutoScaleGltf src={data.modelUrl} data={data} baseMapData={baseMapData} />) : (<Gltf key={data.modelUrl} src={data.modelUrl} castShadow receiveShadow scale={data.modelScale || 1} />)}{(isSelected || hovered) && !(data.type === 'custom_model' && data.locked) && <mesh><boxGeometry args={[1.05, 1.05, 1.05]} /><meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.3} /></mesh>}</Suspense>) : (<mesh castShadow receiveShadow>{(data.type === 'wall' || data.type === 'floor' || data.type === 'column' || data.type === 'door' || data.type === 'cnc' || data.type === 'cube' || data.type === 'custom_model') && (<boxGeometry args={[1, 1, 1]} />)}<meshStandardMaterial color={data.color} roughness={0.5} metalness={0.1} opacity={data.opacity || 1} transparent={(data.opacity || 1) < 1} emissive={!isFloorType && isSelected ? '#444' : (!isFloorType && hovered ? '#222' : '#000')} />{(isSelected || hovered) && <Edges threshold={15} scale={1.001} color={isSelected ? "#60a5fa" : "#ffffff"} />}</mesh>)}
                    </React.Fragment>
                )}
                {isSelected && !data.hideLabel && !(data.type === 'custom_model' && data.locked) && cameraView === 'perspective' && (
                    <Html
                        position={[0, 2 + (data.scale[1] || 1), 0]}
                        center
                        distanceFactor={10}
                        zIndexRange={[100, 0]}
                        style={{
                            pointerEvents: 'none'
                        }}
                    >
                        <div className="info-label flex items-center gap-2">
                            {data.type.includes('wall') ? <BrickWall size={10} className="text-blue-400" /> : <BoxIcon size={10} className="text-orange-400" />}
                            <span>{data.name}</span>
                        </div>
                    </Html>
                )}
            </group>
            {isSelected && !isEditingPoints && !(data.type === 'custom_model' && data.locked) && transformMode && (() => {
                // 根据视图模式决定显示哪些轴
                const axisConfig = {
                    top: { showX: true, showY: false, showZ: true },      // 俯视图：XZ平面
                    front: { showX: true, showY: true, showZ: false },    // 正视图：XY平面
                    perspective: { showX: true, showY: true, showZ: true } // 透视图：全部显示
                };
                const { showX, showY, showZ } = axisConfig[cameraView] || axisConfig.perspective;
                
                return (
                    <TransformControls 
                        object={groupRef} 
                        mode={transformMode} 
                        size={0.8} 
                        space="local"
                        showX={showX}
                        showY={showY}
                        showZ={showZ}
                        translationSnap={enableSnap ? 1 : null}
                        rotationSnap={enableSnap ? THREE.MathUtils.degToRad(15) : null}
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
                );
            })()}
        </>
    );
};

// 组对象的包围盒（用于点击选择）
const GroupBoundingBox = ({ group, children, isSelected, onSelect }) => {
    const groupRef = useRef();
    const [bounds, setBounds] = useState(null);

    // 计算组的包围盒（基于relativePosition）
    useEffect(() => {
        if (!children || children.length === 0) return;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        children.forEach(child => {
            // 使用relativePosition而不是绝对position
            const pos = child.relativePosition || [0, 0, 0];
            const scale = child.scale || [1, 1, 1];
            
            minX = Math.min(minX, pos[0] - scale[0] / 2);
            minY = Math.min(minY, pos[1] - scale[1] / 2);
            minZ = Math.min(minZ, pos[2] - scale[2] / 2);
            
            maxX = Math.max(maxX, pos[0] + scale[0] / 2);
            maxY = Math.max(maxY, pos[1] + scale[1] / 2);
            maxZ = Math.max(maxZ, pos[2] + scale[2] / 2);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        setBounds({
            size: [width, height, depth],
            center: [centerX, centerY, centerZ]
        });
    }, [children]);

    if (!bounds) return null;

    return (
        <group ref={groupRef} position={group.position}>
            {/* 不可见但可点击的包围盒 - 相对于组中心偏移 */}
            <mesh
                position={bounds.center}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(group.id, e.shiftKey, e.ctrlKey || e.metaKey);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    // 双击组的包围盒时，选择第一个子对象（穿透选择）
                    if (children && children.length > 0) {
                        console.log('🎯 双击组包围盒，穿透选择第一个子对象:', children[0].name);
                        onSelect(children[0].id, false, true); // 使用ctrlKey=true来穿透选择
                    }
                }}
            >
                <boxGeometry args={bounds.size} />
                <meshBasicMaterial visible={false} />
            </mesh>
            
            {/* 选中时显示边框 - 相对于组中心偏移 */}
            {isSelected && (
                <lineSegments position={bounds.center}>
                    <edgesGeometry args={[new THREE.BoxGeometry(...bounds.size)]} />
                    <lineBasicMaterial color="#60a5fa" linewidth={2} />
                </lineSegments>
            )}
        </group>
    );
};

// 多选组移动控制器 - 使用 drei TransformControls
const MultiSelectTransformControls = ({ selectedObjects, onDragStart, onDrag, onDragEnd, cameraView, enableSnap }) => {
    const { scene } = useThree();
    const groupRef = useRef();
    const controlsRef = useRef();
    const [center, setCenter] = useState([0, 0, 0]);
    const initialPositionsRef = useRef([]);
    const offsetsRef = useRef([]);
    const lastDragTimeRef = useRef(0); // 用于节流

    // 计算中心点
    useEffect(() => {
        if (selectedObjects.length === 0) return;

        let sumX = 0, sumY = 0, sumZ = 0;
        selectedObjects.forEach(obj => {
            sumX += obj.position[0];
            sumY += obj.position[1];
            sumZ += obj.position[2];
        });

        const centerPoint = [
            sumX / selectedObjects.length,
            sumY / selectedObjects.length,
            sumZ / selectedObjects.length
        ];

        setCenter(centerPoint);

        // 保存初始位置和偏移
        initialPositionsRef.current = selectedObjects.map(obj => [...obj.position]);
        offsetsRef.current = selectedObjects.map(obj => [
            obj.position[0] - centerPoint[0],
            obj.position[1] - centerPoint[1],
            obj.position[2] - centerPoint[2]
        ]);
    }, [selectedObjects]);

    // 创建临时组
    useEffect(() => {
        if (selectedObjects.length === 0) return;

        if (!groupRef.current) {
            groupRef.current = new THREE.Group();
            scene.add(groupRef.current);
        }

        groupRef.current.position.set(...center);
    }, [center, scene, selectedObjects.length]);

    if (selectedObjects.length === 0) return null;

    // 根据视图模式决定显示哪些轴
    const axisConfig = {
        top: { showX: true, showY: false, showZ: true },      // 俯视图：XZ平面
        front: { showX: true, showY: true, showZ: false },    // 正视图：XY平面
        perspective: { showX: true, showY: true, showZ: true } // 透视图：全部显示
    };
    const { showX, showY, showZ } = axisConfig[cameraView] || axisConfig.perspective;

    return (
        <TransformControls
            ref={controlsRef}
            position={center}
            mode="translate"
            translationSnap={enableSnap ? 1 : null}
            showX={showX}
            showY={showY}
            showZ={showZ}
            size={1.5}
            onMouseDown={() => {
                if (onDragStart) onDragStart();
            }}
            onChange={(e) => {
                if (!controlsRef.current) return;

                // 节流：限制更新频率为每16ms一次（约60fps）
                const now = performance.now();
                if (now - lastDragTimeRef.current < 16) return;
                lastDragTimeRef.current = now;

                // 获取控制器的当前位置
                const newPos = controlsRef.current.worldPosition;

                // 计算位移
                const offset = [
                    newPos.x - center[0],
                    newPos.y - center[1],
                    newPos.z - center[2]
                ];

                if (onDrag) onDrag(offset);
            }}
            onMouseUp={() => {
                // 更新中心点为新位置
                if (controlsRef.current) {
                    const newPos = controlsRef.current.worldPosition;
                    setCenter([newPos.x, newPos.y, newPos.z]);
                }

                if (onDragEnd) onDragEnd();
            }}
        />
    );
};

// --- UI 组件 ---
const SidebarItem = ({ asset, onDragStart, onEdit }) => {
    // 确保icon是一个有效的React组件（函数）
    const IconComponent = (typeof asset.icon === 'function') ? asset.icon : Box;
    return (
        <div draggable onDragStart={(e) => {
            e.dataTransfer.setData('type', asset.type);
            if (asset.id) e.dataTransfer.setData('assetId', asset.id); // 传递 assetId
            e.dataTransfer.effectAllowed = 'copy';
        }}
            className="flex items-center gap-3 p-2 mb-1 rounded-md cursor-grab hover:bg-[#222] active:cursor-grabbing transition-colors group"
        >
            <div className="text-gray-500 group-hover:text-gray-300 transition-colors bg-[#1a1a1a] p-1.5 rounded-md border border-[#2a2a2a]"><IconComponent size={14} /></div>
        <span className="text-[11px] text-gray-400 group-hover:text-white font-medium flex-1 truncate">{asset.label}</span>
        {/* 编辑按钮 (仅针对自定义资产) */}
        {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(asset); }} className="p-1 text-gray-500 hover:text-white rounded hover:bg-[#333]">
                <Settings size={12} />
            </button>
        )}
        {!onEdit && <GripVertical size={12} className="text-gray-600 opacity-0 group-hover:opacity-100" />}
        </div>
    );
};

// 更新后的资产编辑弹窗：支持 3D 预览、删除、导出、替换
const AssetEditModal = ({ asset, onClose, onSave, onDelete, onExport, onReplace }) => {
    const [label, setLabel] = useState(asset.label);
    const [scale, setScale] = useState(asset.modelScale || 1);
    const [rotationY, setRotationY] = useState(asset.rotationY || 0);
    const [jsonData, setJsonData] = useState(asset.jsonData || '{ }');
    const replaceInputRef = useRef(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            {/* 加宽弹窗，分为左右两栏 */}
            <div className="bg-[#161616] w-[800px] h-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <span className="text-sm font-bold text-white">编辑资产配置 (Edit Asset)</span>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* 左侧：参数设置表单 */}
                    <div className="w-[320px] p-4 space-y-4 border-r border-[#2a2a2a] overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1.5">资产名称</label>
                            <input value={label} onChange={e => setLabel(e.target.value)} className="w-full bg-[#0f0f0f] border border-[#333] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500" />
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1.5">默认缩放 (Default Scale)</label>
                            <div className="flex items-center gap-2 mb-1">
                                <input 
                                    type="range" 
                                    min="0.001" 
                                    max="5" 
                                    step="0.001" 
                                    value={scale} 
                                    onChange={e => setScale(parseFloat(e.target.value))} 
                                    className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                />
                                <input 
                                    type="number" 
                                    min="0.001"
                                    max="10"
                                    step="0.01"
                                    value={scale} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        // 允许清空输入框
                                        if (val === '' || val === '-') {
                                            setScale(0.001);
                                        } else {
                                            const num = parseFloat(val);
                                            if (!isNaN(num) && num >= 0.001) {
                                                setScale(num);
                                            }
                                        }
                                    }}
                                    onBlur={e => {
                                        // 失去焦点时，如果为空或无效，重置为0.001
                                        const val = parseFloat(e.target.value);
                                        if (isNaN(val) || val < 0.001) {
                                            setScale(0.001);
                                        }
                                    }}
                                    className="w-20 bg-[#0f0f0f] border border-[#333] rounded px-2 py-1 text-xs text-white text-center focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <div className="flex w-full bg-[#1a1a1a] rounded overflow-hidden border border-[#2a2a2a]">
                                <button onClick={() => setScale(0.001)} className="flex-1 py-1.5 hover:bg-[#333] text-[10px] text-gray-400 hover:text-white transition-colors border-r border-[#2a2a2a]" title="毫米单位">mm</button>
                                <button onClick={() => setScale(0.01)} className="flex-1 py-1.5 hover:bg-[#333] text-[10px] text-gray-400 hover:text-white transition-colors border-r border-[#2a2a2a]" title="厘米单位">cm</button>
                                <button onClick={() => setScale(1)} className="flex-1 py-1.5 hover:bg-[#333] text-[10px] text-gray-400 hover:text-white transition-colors" title="米单位">m</button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1.5">默认旋转 Y (Rotation Y)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="-180" max="180" step="1" value={rotationY} onChange={e => setRotationY(parseFloat(e.target.value))} className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                <span className="text-xs text-gray-400 w-8 text-right">{rotationY}°</span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] text-gray-500">业务配置 (JSON)</label>
                                <FileJson size={12} className="text-gray-600" />
                            </div>
                            <textarea value={jsonData} onChange={e => setJsonData(e.target.value)} className="w-full h-32 bg-[#0f0f0f] border border-[#333] rounded p-2 text-[10px] font-mono text-green-400 outline-none resize-none focus:border-blue-500" placeholder="{ 'key': 'value' }"></textarea>
                        </div>

                        {/* 替换模型文件 */}
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1.5">替换模型文件</label>
                            <input 
                                type="file" 
                                ref={replaceInputRef} 
                                className="hidden" 
                                accept=".glb,.gltf" 
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file && onReplace) {
                                        onReplace(asset, file);
                                    }
                                }} 
                            />
                            <button 
                                onClick={() => replaceInputRef.current?.click()} 
                                className="w-full py-2 bg-[#1a1a1a] border border-[#333] rounded text-xs text-gray-400 hover:text-white hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Upload size={14} /> 选择新的.glb文件
                            </button>
                        </div>
                    </div>

                    {/* 右侧：3D 实时预览 */}
                    <div className="flex-1 relative bg-[#111] flex flex-col">
                        <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-gray-300 pointer-events-none border border-white/10">
                            3D 预览 (Preview)
                        </div>
                        <Canvas shadows dpr={[1, 2]} camera={{ position: [2, 2, 3], fov: 45 }}>
                            <color attach="background" args={['#131315']} />
                            <ambientLight intensity={0.7} />
                            <directionalLight position={[5, 10, 7]} intensity={1.2} castShadow />
                            <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} minDistance={1} maxDistance={10} />
                            <gridHelper args={[10, 20, '#333', '#222']} />

                            <Suspense fallback={null}>
                                {/* 动态应用当前的缩放和旋转 */}
                                <group rotation={[0, rotationY * Math.PI / 180, 0]} scale={scale}>
                                    <Gltf src={asset.modelUrl} />
                                </group>
                            </Suspense>
                        </Canvas>
                    </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-between gap-2">
                    {/* 左侧：删除和导出按钮 */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                if (window.confirm(`确定要删除资产"${asset.label}"吗？\n\n使用该资产的所有对象将被重置为默认几何体。`)) {
                                    onDelete(asset);
                                    onClose();
                                }
                            }} 
                            className="px-4 py-2 rounded text-xs text-red-400 hover:bg-red-900/20 transition-colors border border-red-500/30 hover:border-red-500 flex items-center gap-1"
                        >
                            <Trash2 size={14} /> 删除资产
                        </button>
                        <button 
                            onClick={() => onExport(asset)} 
                            className="px-4 py-2 rounded text-xs text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border border-[#333] hover:border-blue-500 flex items-center gap-1"
                        >
                            <Download size={14} /> 导出.glb
                        </button>
                    </div>
                    
                    {/* 右侧：取消和保存按钮 */}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded text-xs text-gray-400 hover:bg-[#252525] transition-colors border border-transparent hover:border-[#333]">取消</button>
                        <button onClick={() => onSave({ ...asset, label, modelScale: scale, rotationY, jsonData })} className="px-4 py-2 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1 shadow-lg shadow-blue-900/20"><Save size={14} /> 保存配置</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PropSection = ({ title, children }) => {
    return (
        <div className="border-b border-[#1a1a1a]">
            <div className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#111]">
                {title}
            </div>
            <div className="px-4 py-3 space-y-3 bg-[#0e0e0e]">
                {children}
            </div>
        </div>
    );
};
const PropRow = ({ label, children, vertical = false }) => (<div className={`flex ${vertical ? 'flex-col items-start gap-2' : 'items-center gap-3'}`}><label className={`text-[11px] text-gray-500 shrink-0 ${vertical ? 'w-full text-left pl-1' : 'w-16'}`}>{label}</label><div className="flex-1 flex gap-2 w-full">{children}</div></div>);
const SmartInput = ({ value, onChange, step = 0.1, label, suffix, disabled, className, min }) => {
    const inputRef = useRef(null);
    
    // 当外部value变化时，更新输入框（仅在非聚焦时）
    useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.value = value;
        }
    }, [value]);

    const handleBlur = (e) => {
        const val = e.target.value.trim();
        let num = parseFloat(val);
        
        if (val === '' || isNaN(num)) {
            // 无效输入，恢复默认值
            num = min !== undefined ? min : 0;
        } else if (min !== undefined && num < min) {
            // 应用最小值限制
            num = min;
        }
        
        // 更新输入框显示和外部状态
        e.target.value = num;
        onChange(num);
    };

    return (
        <div className={`flex-1 relative flex items-center ${className || ''}`}>
            {label && <span className="pl-2 text-[9px] text-gray-500 font-bold select-none">{label}</span>}
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                defaultValue={value}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        e.target.blur();
                    }
                }}
                onKeyUp={(e) => e.stopPropagation()}
                onKeyPress={(e) => e.stopPropagation()}
                disabled={disabled}
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors disabled:cursor-not-allowed"
            />
            {suffix && <span className="absolute right-3 text-[10px] text-gray-500 select-none pointer-events-none">{suffix}</span>}
        </div>
    );
};
const DarkInput = SmartInput;
const ToolBtn = ({ icon: Icon, active, onClick, title }) => (<button onClick={onClick} className={`p-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-gray-400 hover:bg-[#333] hover:text-gray-200'}`} title={title}><Icon size={18} strokeWidth={2} /></button>);

// 框选逻辑管理器组件
// 修复后的 SelectionManager - 不再拦截对象点击
const SelectionManager = ({ isBoxSelecting, setIsBoxSelecting, setSelectionBox, toolMode, viewMode, objects, onSelect }) => {
    const { gl, camera, raycaster, scene } = useThree();
    const startPosRef = useRef(null);
    const hasMovedRef = useRef(false);
    const isPointerDownRef = useRef(false);

    const getObjectCorners = (obj) => {
        if (obj.type === 'point') {
            // For points, just return its position as a "corner" for selection purposes
            return [new THREE.Vector3(obj.position[0], obj.position[1], obj.position[2])];
        }
        if (obj.points && obj.points.length > 0) {
            return obj.points.map(p => new THREE.Vector3(
                obj.position[0] + p.x,
                obj.position[1],
                obj.position[2] + p.z
            ));
        }
        const halfScaleX = (obj.scale?.[0] || 1) / 2;
        const halfScaleY = (obj.scale?.[1] || 1) / 2;
        const halfScaleZ = (obj.scale?.[2] || 1) / 2;
        const rotation = obj.rotation?.[1] || 0;
        const corners3D = [
            [-halfScaleX, -halfScaleY, -halfScaleZ],
            [halfScaleX, -halfScaleY, -halfScaleZ],
            [halfScaleX, -halfScaleY, halfScaleZ],
            [-halfScaleX, -halfScaleY, halfScaleZ],
            [-halfScaleX, halfScaleY, -halfScaleZ],
            [halfScaleX, halfScaleY, -halfScaleZ],
            [halfScaleX, halfScaleY, halfScaleZ],
            [-halfScaleX, halfScaleY, halfScaleZ]
        ];
        return corners3D.map(([x, y, z]) => {
            const rotatedX = x * Math.cos(rotation) - z * Math.sin(rotation);
            const rotatedZ = x * Math.sin(rotation) + z * Math.cos(rotation);
            return new THREE.Vector3(
                obj.position[0] + rotatedX,
                obj.position[1] + y,
                obj.position[2] + rotatedZ
            );
        });
    };

    const projectToScreen = (point, rect) => {
        const projected = point.clone().project(camera);
        return {
            x: (projected.x * 0.5 + 0.5) * rect.width,
            y: (-(projected.y * 0.5) + 0.5) * rect.height
        };
    };

    // 检查点击位置是否在某个对象上
    const checkHitObject = (e) => {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera({ x, y }, camera);

        // 获取场景中所有可选择的对象
        const selectableObjects = [];
        scene.traverse((child) => {
            if (child.isMesh && child.parent?.name) {
                // 排除多选控制器 gizmo
                if (child.parent.name === '__multiselect_gizmo__') return;

                const obj = objects.find(o => o.id === child.parent.name);
                if (obj && !obj.locked && !obj.isBaseMap && obj.visible) {
                    selectableObjects.push(child);
                }
            }
        });
        const intersects = raycaster.intersectObjects(selectableObjects, true);
        return intersects.length > 0;
    };

    const isSpacePressedRef = useRef(false);

    // Track Space key for SelectionManager to know when to yield
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.code === 'Space') isSpacePressedRef.current = true; };
        const handleKeyUp = (e) => { if (e.code === 'Space') isSpacePressedRef.current = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        if (toolMode !== 'select') return;

        const canvas = gl.domElement;

        const handlePointerDown = (e) => {
            // 检查全局标记 - 如果 gizmo 被点击，立即返回
            if (window.__gizmo_click_active__) {
                console.log('✋ SelectionManager: Gizmo is active, skipping');
                window.__gizmo_click_active__ = false; // 重置标记
                return;
            }

            // Ignore if Space or Alt is pressed (let OrbitControls handle it)
            if (e.button !== 0 || e.altKey || isSpacePressedRef.current) return;

            // **关键修复：检查是否点击在多选控制器上**
            // 如果点击在 gizmo 上，立即返回，让 R3F 的事件处理器处理
            const rect = gl.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera({ x, y }, camera);

            // 检查是否击中 gizmo
            const gizmoObjects = [];
            scene.traverse((child) => {
                if (child.isMesh && child.parent?.name === '__multiselect_gizmo__') {
                    gizmoObjects.push(child);
                }
            });

            const gizmoIntersects = raycaster.intersectObjects(gizmoObjects, true);
            if (gizmoIntersects.length > 0) {
                console.log('✋ SelectionManager: Clicked on gizmo, blocking event');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false; // 完全阻止事件
            }

            // 检查是否点击在对象上 - 如果是，不启动框选
            if (checkHitObject(e)) {
                isPointerDownRef.current = false;
                return;
            }

            // 使用之前已声明的 rect 变量
            startPosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                shiftKey: e.shiftKey
            };
            hasMovedRef.current = false;
            isPointerDownRef.current = true;
        };

        const handlePointerMove = (e) => {
            if (!startPosRef.current || !isPointerDownRef.current) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const dx = x - startPosRef.current.x;
            const dy = y - startPosRef.current.y;

            if (!isBoxSelecting && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                hasMovedRef.current = true;
                setIsBoxSelecting(true);
                setSelectionBox({
                    start: { x: startPosRef.current.x, y: startPosRef.current.y },
                    end: { x, y }
                });
            } else if (isBoxSelecting) {
                setSelectionBox(prev => prev ? { ...prev, end: { x, y } } : null);
            }
        };

        const handlePointerUp = (e) => {
            if (!isPointerDownRef.current) return;

            const rect = canvas.getBoundingClientRect();

            if (isBoxSelecting) {
                setIsBoxSelecting(false);
                setSelectionBox(prev => {
                    if (!prev) return null;

                    const startX = Math.min(prev.start.x, prev.end.x);
                    const endX = Math.max(prev.start.x, prev.end.x);
                    const startY = Math.min(prev.start.y, prev.end.y);
                    const endY = Math.max(prev.start.y, prev.end.y);

                    if (endX - startX > 3 && endY - startY > 3) {
                        const selected = [];

                        objects.forEach(obj => {
                            if (obj.locked || !obj.visible || obj.isBaseMap) return;

                            const corners = getObjectCorners(obj);
                            const screenCorners = corners.map(c => projectToScreen(c, rect));

                            const minX = Math.min(...screenCorners.map(c => c.x));
                            const maxX = Math.max(...screenCorners.map(c => c.x));
                            const minY = Math.min(...screenCorners.map(c => c.y));
                            const maxY = Math.max(...screenCorners.map(c => c.y));

                            const intersects = !(maxX < startX || minX > endX || maxY < startY || minY > endY);
                            const hasCornerInside = screenCorners.some(corner =>
                                corner.x >= startX && corner.x <= endX &&
                                corner.y >= startY && corner.y <= endY
                            );
                            const centerX = (minX + maxX) / 2;
                            const centerY = (minY + maxY) / 2;
                            const centerInside = centerX >= startX && centerX <= endX &&
                                centerY >= startY && centerY <= endY;

                            if (intersects || hasCornerInside || centerInside) {
                                selected.push(obj.id);
                            }
                        });

                        if (selected.length > 0) {
                            onSelect(selected);
                        } else if (!startPosRef.current?.shiftKey) {
                            onSelect([]);
                        }
                    }
                    return null;
                });
            } else if (startPosRef.current && !hasMovedRef.current && !e.shiftKey) {
                // 点击空白处取消选择
                onSelect([]);
            }

            startPosRef.current = null;
            hasMovedRef.current = false;
            isPointerDownRef.current = false;
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [toolMode, isBoxSelecting, objects, camera, gl, raycaster, scene, onSelect, setIsBoxSelecting, setSelectionBox]);

    return null;
};

// 批量操作辅助组件：获取 scene 引用
function SceneRefGetter({ setSceneRef }) {
    const { scene } = useThree();

    useEffect(() => {
        setSceneRef(scene);
    }, [scene, setSceneRef]);

    return null;
}

// 批量操作辅助组件：框选集成
function BoxSelectionIntegration({ onSelectionChange, enabled }) {
    const { camera, scene, gl: renderer } = useThree();

    return (
        <BoxSelection
            camera={camera}
            scene={scene}
            renderer={renderer}
            onSelectionChange={onSelectionChange}
            enabled={enabled}
        />
    );
}

const App = () => {
    // 本地存储键名
    const LOCAL_STORAGE_KEY = 'digital-twin-pro-data';
    const DATA_VERSION_KEY = 'digital-twin-pro-version';
    const CURRENT_VERSION = '2.0'; // 当前数据版本
    
    // 从本地存储加载数据
    const loadFromLocalStorage = () => {
        try {
            // 检查数据版本
            const savedVersion = localStorage.getItem(DATA_VERSION_KEY);
            
            // 如果版本不匹配，清除旧数据
            if (savedVersion !== CURRENT_VERSION) {
                console.log('🔄 检测到旧版本数据 (v' + (savedVersion || '1.0') + ')，清除并使用新版本 (v' + CURRENT_VERSION + ')');
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION);
                return null;
            }
            
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                console.log('📦 从本地存储加载数据 (v' + CURRENT_VERSION + '):', data);
                
                // 🔑 迁移逻辑：修正底图位置和透明度
                if (data.objects) {
                    data.objects = data.objects.map(obj => {
                        if (obj.type === 'map_image' && obj.isBaseMap) {
                            console.log('🔧 修正objects中的底图:', obj.id);
                            return {
                                ...obj,
                                position: [0, 0.1, 0], // Y=0.1，稍微高于地面
                                opacity: 0.5 // 半透明
                            };
                        }
                        return obj;
                    });
                }
                
                // 🔑 修正floors中每个楼层的底图
                if (data.floors) {
                    data.floors = data.floors.map(scene => ({
                        ...scene,
                        floorLevels: scene.floorLevels.map(floor => ({
                            ...floor,
                            objects: floor.objects?.map(obj => {
                                if (obj.type === 'map_image' && obj.isBaseMap) {
                                    console.log('🔧 修正floors中的底图:', obj.id);
                                    return {
                                        ...obj,
                                        position: [0, 0.1, 0],
                                        opacity: 0.5
                                    };
                                }
                                return obj;
                            }) || []
                        }))
                    }));
                }
                
                return data;
            }
        } catch (error) {
            console.error('❌ 加载本地数据失败:', error);
            // 如果加载失败，清除损坏的数据
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
        return null;
    };
    
    const initialObjects = [];
    const [objects, setObjects] = useState(() => {
        const saved = loadFromLocalStorage();
        return saved?.objects || initialObjects;
    });

    // 暴露 objects 到全局，供吸附逻辑使用
    useEffect(() => {
        window.__editorObjects = objects;
    }, [objects]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]); // 多选支持
    const [editingNameId, setEditingNameId] = useState(null); // 正在编辑名称的对象ID
    const [editingName, setEditingName] = useState(''); // 编辑中的名称
    const dragOffsetRef = useRef(null); // 使用 ref 存储拖动偏移，避免频繁渲染
    const historyRef = useRef({ history: [initialObjects], index: 0 }); // 存储最新的history状态
    const [dragOffset, setDragOffset] = useState(null); // 多选拖动偏移 [x, y, z]
    const [isDragging, setIsDragging] = useState(false); // 是否正在拖动多选对象
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState(null); // 框选区域 {start, end} // 多选支持
    const [transformMode, setTransformMode] = useState('translate');
    const [toolMode, setToolMode] = useState('select');
    const [isBatchSelectMode, setIsBatchSelectMode] = useState(false); // 批量选择模式
    const [viewMode, setViewMode] = useState('3d');
    const [cameraView, setCameraView] = useState('perspective'); // 'top', 'front', 'perspective'
    const [isEditingPoints, setIsEditingPoints] = useState(false);
    const [history, setHistory] = useState([initialObjects]);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // 同步history到ref
    useEffect(() => {
        historyRef.current = { history, index: historyIndex };
    }, [history, historyIndex]);
    
    const [sidebarTab, setSidebarTab] = useState('assets');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false); // 预览模式状态（已禁用）
    const isPreviewModeDisabled = true; // 强制禁用预览模式
    const [isCameraDragging, setIsCameraDragging] = useState(false); // 用于判断相机是否正在拖动
    const [cameraZoom, setCameraZoom] = useState({
        orthographic: 5,  // 2D和俯视图/正视图的缩放
        perspective: 10   // 3D透视图的距离
    }); // 相机缩放状态
    const [enableSnap, setEnableSnap] = useState(true); // 吸附开关状态，默认开启
    const [gridSize, setGridSize] = useState(1); // 网格大小，默认1米
    const [isPanelVisible, setIsPanelVisible] = useState(true); // 属性面板可见性

    // 批量操作状态
    const [batchSelectedObjects, setBatchSelectedObjects] = useState([]);
    const [sceneRef, setSceneRef] = useState(null);

    const fileInputRef = useRef(null);
    const assetUploadRef = useRef(null);
    const [customAssets, setCustomAssets] = useState(() => {
        // 从localStorage加载自定义资产，但过滤掉包含blob URL的旧资产
        const saved = loadFromLocalStorage();
        if (saved?.customAssets) {
            return saved.customAssets
                .filter(asset => {
                    // 只保留Base64格式的资产（以data:开头）
                    if (asset.modelUrl && asset.modelUrl.startsWith('blob:')) {
                        console.warn('⚠️ 跳过失效的blob URL资产:', asset.label);
                        return false;
                    }
                    return true;
                })
                .map(asset => ({
                    ...asset,
                    icon: asset.icon || Box // 确保每个资产都有icon
                }));
        }
        return [];
    });
    const [editingAsset, setEditingAsset] = useState(null);

    // 默认资产配置（可修改）
    const [defaultAssetConfigs, setDefaultAssetConfigs] = useState({
        cnc: { modelScale: 1, scale: [1, 1, 1] }
    });

    // 场景管理状态
    const [floors, setFloors] = useState(() => {
        const saved = loadFromLocalStorage();
        return saved?.floors || [
            {
                id: 'default',
                name: '默认场景',
                description: '默认场景',
                isDefault: true,
                // 楼层列表 - 每个楼层有自己的地图和对象
                floorLevels: [
                    { 
                        id: 'floor-1', 
                        name: '1F', 
                        height: 0, 
                        visible: true, 
                        objects: [],
                        // 地图相关数据（每个楼层独立）
                        baseMapId: null,
                        baseMapData: null,
                        waypointsData: null,
                        pathsData: null,
                        sceneModelData: null
                    }
                ]
            }
        ];
    });
    const [currentFloorId, setCurrentFloorId] = useState(() => {
        const saved = loadFromLocalStorage();
        return saved?.currentFloorId || 'default';
    });
    const [currentFloorLevelId, setCurrentFloorLevelId] = useState(() => {
        const saved = loadFromLocalStorage();
        return saved?.currentFloorLevelId || 'floor-1';
    }); // 当前楼层ID
    const [showFloorManager, setShowFloorManager] = useState(false);
    const [editingFloor, setEditingFloor] = useState(null);
    const [editingFloorLevelId, setEditingFloorLevelId] = useState(null); // 正在编辑地图的楼层ID
    const [currentMapPath, setCurrentMapPath] = useState(null);
    const [availableMaps] = useState(getAvailableMaps());
    const [floorDataCache, setFloorDataCache] = useState({}); // 缓存场景数据
    const [showConflictDialog, setShowConflictDialog] = useState(false); // 冲突检测对话框
    const [conflictData, setConflictData] = useState(null); // 冲突数据
    const [showMergeDialog, setShowMergeDialog] = useState(false); // 合并策略对话框
    const [mergeDialogData, setMergeDialogData] = useState(null); // 合并对话框数据
    const [mergeStrategy, setMergeStrategy] = useState('merge'); // 合并策略选择: 'merge' | 'overwrite'
    const [showOverwriteConfirmDialog, setShowOverwriteConfirmDialog] = useState(false);
    const [pendingNewSceneData, setPendingNewSceneData] = useState(null);
    const [overwriteDefaultScene, setOverwriteDefaultScene] = useState(false);

    // 保存和退出相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
    const [lastSavedState, setLastSavedState] = useState(null);

    const [clipboard, setClipboard] = useState([]); // 剪贴板状态
    const [showSLAMUpload, setShowSLAMUpload] = useState(false); // SLAM 上传模态框
    const [showMapSelector, setShowMapSelector] = useState(false); // 地图选择器模态框
    const [selectedMapTemplate, setSelectedMapTemplate] = useState(null); // 选中的地图模板
    const slamYamlInputRef = useRef(null);
    const slamImageInputRef = useRef(null);
    const jsonImportRef = useRef(null);

    // 获取当前场景和楼层
    const currentScene = useMemo(() => {
        return floors.find(f => f.id === currentFloorId) || floors[0];
    }, [floors, currentFloorId]);

    const currentFloorLevel = useMemo(() => {
        if (!currentScene || !currentScene.floorLevels || currentScene.floorLevels.length === 0) {
            console.warn('⚠️ 当前场景没有楼层配置');
            return null;
        }
        const level = currentScene.floorLevels.find(fl => fl.id === currentFloorLevelId);
        if (!level) {
            console.warn('⚠️ 未找到指定楼层，使用第一个楼层');
            return currentScene.floorLevels[0];
        }
        return level;
    }, [currentScene, currentFloorLevelId]);

    // 楼层管理函数
    const addFloorLevel = useCallback((name = null) => {
        const floorNumber = currentScene.floorLevels.length + 1;
        const newFloorLevel = {
            id: `floor-${Date.now()}`,
            name: name || `${floorNumber}F`,
            height: (floorNumber - 1) * 3, // 每层默认3米高
            visible: true,
            objects: [],
            // 地图相关数据（每个楼层独立）
            baseMapId: null,
            baseMapData: null,
            waypointsData: null,
            pathsData: null,
            sceneModelData: null
        };

        setFloors(prev => prev.map(scene => {
            if (scene.id === currentFloorId) {
                return {
                    ...scene,
                    floorLevels: [...scene.floorLevels, newFloorLevel]
                };
            }
            return scene;
        }));

        setCurrentFloorLevelId(newFloorLevel.id);
        console.log('✅ 新增楼层:', newFloorLevel.name);
    }, [currentScene, currentFloorId]);

    const deleteFloorLevel = useCallback((floorLevelId) => {
        if (currentScene.floorLevels.length <= 1) {
            alert('至少需要保留一个楼层');
            return;
        }

        // 找到要删除的楼层名称
        const floorToDelete = currentScene.floorLevels.find(fl => fl.id === floorLevelId);
        if (!floorToDelete) return;

        // 删除该楼层的所有对象
        const newObjects = objects.filter(obj => obj.floorLevel !== floorToDelete.name);
        setObjects(newObjects);
        commitHistory(newObjects);

        // 更新楼层列表
        setFloors(prev => prev.map(scene => {
            if (scene.id === currentFloorId) {
                const newFloorLevels = scene.floorLevels.filter(fl => fl.id !== floorLevelId);
                return {
                    ...scene,
                    floorLevels: newFloorLevels
                };
            }
            return scene;
        }));

        // 如果删除的是当前楼层，切换到第一个楼层
        if (floorLevelId === currentFloorLevelId) {
            const remainingFloors = currentScene.floorLevels.filter(fl => fl.id !== floorLevelId);
            if (remainingFloors.length > 0) {
                setCurrentFloorLevelId(remainingFloors[0].id);
            }
        }

        console.log('🗑️ 删除楼层:', floorLevelId);
    }, [currentScene, currentFloorId, currentFloorLevelId]);

    const renameFloorLevel = useCallback((floorLevelId, newName) => {
        setFloors(prev => prev.map(scene => {
            if (scene.id === currentFloorId) {
                return {
                    ...scene,
                    floorLevels: scene.floorLevels.map(fl =>
                        fl.id === floorLevelId ? { ...fl, name: newName } : fl
                    )
                };
            }
            return scene;
        }));
        console.log('✏️ 重命名楼层:', newName);
    }, [currentFloorId]);

    const toggleFloorLevelVisibility = useCallback((floorLevelId) => {
        setFloors(prev => prev.map(scene => {
            if (scene.id === currentFloorId) {
                return {
                    ...scene,
                    floorLevels: scene.floorLevels.map(fl =>
                        fl.id === floorLevelId ? { ...fl, visible: !fl.visible } : fl
                    )
                };
            }
            return scene;
        }));
    }, [currentFloorId]);

    // 保存场景函数
    const saveCurrentScene = useCallback(() => {
        // 更新当前场景的对象数据
        const updatedFloors = floors.map(f => {
            if (f.id === currentFloorId) {
                return {
                    ...f,
                    objects: objects,
                    lastSaved: new Date().toISOString()
                };
            }
            return f;
        });
        
        setFloors(updatedFloors);
        setLastSavedState(JSON.stringify({ floors: updatedFloors, objects }));
        setHasUnsavedChanges(false);
        
        console.log('💾 场景已保存:', currentScene?.name);
        alert(`✅ 场景 "${currentScene?.name}" 已保存`);
    }, [floors, currentFloorId, objects, currentScene]);

    // 保存并退出
    const saveAndExit = useCallback(() => {
        saveCurrentScene();
        setShowFloorManager(false);
    }, [saveCurrentScene]);

    // 退出（带未保存检测）
    const exitWithConfirmation = useCallback(() => {
        if (hasUnsavedChanges) {
            setShowExitConfirmDialog(true);
        } else {
            setShowFloorManager(false);
        }
    }, [hasUnsavedChanges]);

    // 强制退出（不保存）
    const forceExit = useCallback(() => {
        setShowExitConfirmDialog(false);
        setShowFloorManager(false);
        setHasUnsavedChanges(false);
    }, []);

    const selectedObject = objects.find(o => o && o.id === selectedId);
    const filteredObjects = objects.filter(obj => 
        obj && 
        // 🔑 隐藏锁定的GLB模型（地图模型）
        !(obj.type === 'custom_model' && obj.locked) &&
        ((obj.name && obj.name.toLowerCase().includes(searchQuery.toLowerCase())) || (obj.type && obj.type.toLowerCase().includes(searchQuery.toLowerCase())))
    );
    const defaultAssets = [
        { type: 'wall', label: '标准墙体', icon: BrickWall, category: '建筑' },
        { type: 'door', label: '标准门', icon: DoorOpen, category: '建筑' },
        { type: 'column', label: '标准柱子', icon: Columns, category: '建筑' },
        { type: 'floor', label: '标准地面', icon: LandPlot, category: '建筑' },
        { type: 'cube', label: '占位方块', icon: Box, category: '建筑' },
        { type: 'cnc', label: 'CNC', icon: Server, category: '设备', modelUrl: `${import.meta.env.BASE_URL}cnc.glb`, modelScale: 1 },
    ];
    const allAssets = [...defaultAssets, ...customAssets];
    const filteredAssets = allAssets.filter(asset => asset.label.toLowerCase().includes(searchQuery.toLowerCase()));

    // 加载地图数据
    const loadMapData = useCallback(async (mapPath) => {
        try {
            console.log('📥 加载地图数据:', mapPath);
            const { floors: loadedFloors, mapDataMap, rawData, format } = await loadFloorData(mapPath);

            if (loadedFloors.length > 0) {
                console.log('✅ 成功加载场景数据:', loadedFloors, '格式:', format);

                // 缓存数据
                setFloorDataCache(prev => ({
                    ...prev,
                    [mapPath]: { floors: loadedFloors, mapDataMap, rawData, format }
                }));

                // 更新场景列表
                setFloors(loadedFloors);
                setCurrentFloorId(loadedFloors[0].id);

                // 加载第一个场景（包含路径）
                await loadFloorObjects(loadedFloors[0], mapDataMap, rawData, false);
            }
        } catch (error) {
            console.error('❌ 加载地图数据失败:', error);
        }
    }, []);

    // 加载场景对象（SLAM 底图 + 点位 + 路径）
    const loadFloorObjects = useCallback(async (floor, mapDataMap, rawData, keepExisting = false) => {
        const floorObjects = [];

        // 添加 SLAM 底图
        if (floor.mapFileId && mapDataMap[floor.mapFileId]) {
            const mapData = mapDataMap[floor.mapFileId];
            const base64Image = mapData.imageData || mapData.content;

            const mapWidth = (mapData.width || mapData.actualSize?.width || 100) * (mapData.resolution || 0.05);
            const mapHeight = (mapData.height || mapData.actualSize?.height || 100) * (mapData.resolution || 0.05);

            const baseMapObj = {
                id: `map_${mapData.uid || mapData.id || Date.now()}`,
                type: 'map_image',
                name: mapData.name || mapData.alias || '地图底图',
                position: [0, -0.01, 0],
                rotation: [0, 0, 0],
                scale: [mapWidth, 1, mapHeight],
                color: '#ffffff',
                opacity: 0.8,
                visible: true,
                locked: true,
                isBaseMap: true,
                imageData: base64Image.startsWith('data:') || base64Image.startsWith('http')
                    ? base64Image
                    : `data:image/png;base64,${base64Image}`,
                mapMetadata: mapData
            };

            floorObjects.push(baseMapObj);
            console.log('🗺️ 添加底图:', baseMapObj.name, '尺寸:', mapWidth.toFixed(2), 'x', mapHeight.toFixed(2));
        } else if (floor.mapData) {
            const mapData = floor.mapData;
            const mapWidth = mapData.actualSize.width * mapData.resolution;
            const mapHeight = mapData.actualSize.height * mapData.resolution;

            const baseMapObj = {
                id: `map_${mapData.id}`,
                type: 'map_image',
                name: mapData.name || '地图底图',
                position: [0, -0.01, 0],
                rotation: [0, 0, 0],
                scale: [mapWidth, 1, mapHeight],
                color: '#ffffff',
                opacity: 0.8,
                visible: true,
                locked: true,
                isBaseMap: true,
                imageData: mapData.imageData,
                mapMetadata: mapData
            };

            floorObjects.push(baseMapObj);
            console.log('🗺️ 添加底图:', baseMapObj.name);
        }

        // 添加点位
        if (floor.poses && floor.poses.length > 0) {
            floor.poses.forEach(pose => {
                const poseObj = {
                    id: `pose_${pose.uid}`,
                    type: 'waypoint',
                    name: pose.name || pose.alias,
                    position: [pose.x, 0.1, pose.y],
                    rotation: [0, pose.yaw, 0],
                    scale: [0.3, 0.3, 0.3],
                    color: pose.parkable ? '#4CAF50' : (pose.dockable ? '#2196F3' : '#FFC107'),
                    opacity: 1,
                    visible: true,
                    poseData: pose
                };
                floorObjects.push(poseObj);
            });
            console.log('📍 添加点位:', floor.poses.length, '个');
        }

        // 添加路径（从 rawData 中获取）
        if (rawData?.graphTopologys) {
            rawData.graphTopologys.forEach(topology => {
                if (topology.paths && topology.poses) {
                    topology.paths.forEach(path => {
                        const sourcePose = topology.poses.find(p => p.name === path.sourceName);
                        const targetPose = topology.poses.find(p => p.name === path.targetName);

                        if (sourcePose && targetPose) {
                            const pathObj = {
                                id: `path_${path.uid}`,
                                type: 'path_line',
                                name: path.name || `路径 ${path.sourceName} -> ${path.targetName}`,
                                points: [
                                    { x: sourcePose.x, z: sourcePose.y },
                                    { x: targetPose.x, z: targetPose.y }
                                ],
                                position: [0, 0.05, 0],
                                rotation: [0, 0, 0],
                                scale: [1, 1, 1],
                                color: path.bidirectional ? '#00FF00' : '#FF9800',
                                opacity: 0.8,
                                visible: true,
                                pathData: path
                            };
                            floorObjects.push(pathObj);
                        }
                    });
                    console.log('🛤️ 添加路径:', topology.paths.length, '条');
                }
            });
        }

        // 更新场景对象
        const baseFloor = initialObjects[0];
        let newObjects;

        if (keepExisting) {
            // 保留现有对象，叠加新内容
            const existingObjects = objects.filter(o => !o.isBaseMap && o.id !== baseFloor.id);
            newObjects = [baseFloor, ...existingObjects, ...floorObjects];
            console.log('📦 保留现有对象，叠加新内容');
        } else {
            // 替换所有内容
            newObjects = [baseFloor, ...floorObjects];
            console.log('🔄 替换场景内容');
        }

        setObjects(newObjects);
        setHistory([newObjects]);
        setHistoryIndex(0);

        console.log(`✅ 已加载 ${floor.name}，包含 ${floor.poses?.length || 0} 个点位`);
    }, [objects]);

    // 初始化：不自动加载地图，保持空场景
    // useEffect(() => {
    //     loadMapData(currentMapPath);
    // }, []);

    // 核心：处理地图导入（合并策略管理器）
    const handleMapImport = useCallback(async (jsonContent, isNewScene = true, sceneName = null) => {
        try {
            // 1. 解析数据
            const { baseMap, entities: newEntities, paths: newPaths, rawData } = parseFullMapJson(jsonContent);

            if (!baseMap) {
                alert('❌ 无法解析地图数据，请检查 JSON 格式');
                return;
            }

            console.log('📦 解析完成:', {
                baseMap: baseMap.name,
                entities: newEntities.length,
                paths: newPaths.length
            });

            // 2. 判断当前状态
            const isDefaultScene = floors.length === 1 && floors[0].isDefault;
            const sceneIsClean = isSceneClean(objects);

            // 3. 检查是否有路网绑定的实体（判断是否为更新操作）
            const hasNetworkEntities = objects.some(o => o.sourceRefId && o.type === 'waypoint');

            // --- 场景 A: 新建场景（默认场景或创建新场景） ---
            if (isNewScene) {
                // 明确标记为新建场景，直接创建，不管当前场景状态
                console.log('✅ 新建场景，直接加载');
                const finalObjects = [initialObjects[0], baseMap, ...newEntities, ...newPaths].filter(Boolean);
                setObjects(finalObjects);
                setHistory([finalObjects]);
                setHistoryIndex(0);

                // 创建新场景（保存场景数据）
                const newFloor = {
                    id: uuidv4(),
                    name: sceneName || '场景 1',
                    description: `包含 ${newEntities.length} 个点位`,
                    mapPath: null,
                    isDefault: false,
                    objects: finalObjects,  // 保存场景对象
                    baseMapData: baseMap,   // 保存底图数据
                    entitiesData: newEntities,  // 保存点位数据
                    pathsData: newPaths     // 保存路径数据
                };

                // 如果是默认场景，替换；否则添加
                if (isDefaultScene) {
                    setFloors([newFloor]);
                } else {
                    setFloors([...floors, newFloor]);
                }
                setCurrentFloorId(newFloor.id);

                alert(`✅ 场景创建成功\n\n场景: ${sceneName}\n地图: ${baseMap.name}\n点位: ${newEntities.length} 个\n路径: ${newPaths.length} 条`);
                return;
            }

            // --- 场景 A2: 默认场景有内容（特殊处理） ---
            if (isDefaultScene && !sceneIsClean) {
                // 默认场景有内容，简单确认
                console.log('⚠️ 默认场景有内容，询问用户');
                const userChoice = window.confirm(
                    '⚠️ 当前场景已有编辑内容\n\n' +
                    '导入新地图将覆盖现有内容，是否继续？\n\n' +
                    '• 点击"确定"：清空现有内容，导入新地图\n' +
                    '• 点击"取消"：取消导入'
                );

                if (!userChoice) {
                    console.log('❌ 用户取消导入');
                    return;
                }

                // 覆盖
                console.log('🔄 覆盖所有内容');
                const finalObjects = [initialObjects[0], baseMap, ...newEntities, ...newPaths].filter(Boolean);
                setObjects(finalObjects);
                setHistory([finalObjects]);
                setHistoryIndex(0);

                // 创建新场景
                const newFloor = {
                    id: uuidv4(),
                    name: sceneName || '场景 1',
                    description: `包含 ${newEntities.length} 个点位`,
                    mapPath: null,
                    isDefault: false
                };
                setFloors([newFloor]);
                setCurrentFloorId(newFloor.id);

                alert(`✅ 场景创建成功\n\n地图: ${baseMap.name}\n点位: ${newEntities.length} 个\n路径: ${newPaths.length} 条`);
                return;
            }

            // --- 场景 B: 更新已有场景（保护劳动成果） ---
            if (!isDefaultScene && hasNetworkEntities) {
                console.log('🔄 检测到更新已有场景，启动智能合并');

                // 弹出合并策略选择（复杂的保留绑定策略）
                setMergeDialogData({
                    baseMap,
                    newEntities,
                    newPaths,
                    rawData
                });
                setShowMergeDialog(true);
                return;
            }

            // --- 场景 C: 正式场景但没有路网实体（视为新建） ---
            console.log('✅ 正式场景但无路网实体，直接加载');
            const finalObjects = [initialObjects[0], baseMap, ...newEntities, ...newPaths].filter(Boolean);
            setObjects(finalObjects);
            setHistory([finalObjects]);
            setHistoryIndex(0);
            alert(`✅ 场景更新成功\n\n地图: ${baseMap.name}\n点位: ${newEntities.length} 个\n路径: ${newPaths.length} 条`);

        } catch (error) {
            console.error('❌ 地图导入失败:', error);
            alert(`❌ 地图导入失败\n\n${error.message}`);
        }
    }, [objects, floors]);

    // 自动计算模型适配参数
    const autoAlignModelToMap = useCallback(async (file, mapPath) => {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. 获取 SLAM 地图的物理尺寸 (作为目标容器)
                let mapWidth = 100; // 默认值
                let mapHeight = 100; // 默认值

                // 尝试获取真实的地图数据
                if (mapPath) {
                    try {
                        const response = await fetch(mapPath);
                        const json = await response.json();
                        const record = json.mapfileEntitys?.[0]?.record;
                        if (record) {
                            mapWidth = record.width * record.resolution;
                            mapHeight = record.height * record.resolution;
                        }
                    } catch (err) {
                        console.warn('⚠️ 无法获取地图尺寸，使用默认值');
                    }
                }

                console.log(`🎯 目标对齐尺寸: ${mapWidth.toFixed(2)}m x ${mapHeight.toFixed(2)}m`);

                // 2. 预加载 GLB 模型以计算其原始尺寸
                const loader = new GLTFLoader();

                // 配置 DRACOLoader（如果模型使用了 Draco 压缩）
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
                loader.setDRACOLoader(dracoLoader);

                // 将文件转换为 base64 data URL（持久化存储）
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;

                    loader.load(dataUrl, (gltf) => {
                        const model = gltf.scene;

                        // 计算包围盒
                        const box = new THREE.Box3().setFromObject(model);
                        const size = new THREE.Vector3();
                        box.getSize(size); // 获取模型原始长宽高
                        const center = new THREE.Vector3();
                        box.getCenter(center); // 获取模型原始中心点

                        console.log(`📦 模型原始尺寸: ${size.x.toFixed(2)} x ${size.z.toFixed(2)}`);

                        // 3. 计算缩放比例 (Scale)
                        // 分别计算 X 和 Z 的缩放比例以完美匹配 SLAM 边界
                        const scaleX = mapWidth / size.x;
                        const scaleZ = mapHeight / size.z;

                        // 4. 计算位置修正 (Centering)
                        // 把模型的中心点移动到 (0,0,0)
                        const positionX = -(center.x * scaleX);
                        const positionZ = -(center.z * scaleZ);
                        const positionY = -box.min.y * scaleX; // 让模型底部贴地

                        console.log(`✅ 计算完成 - 缩放: [${scaleX.toFixed(4)}, ${scaleX.toFixed(4)}, ${scaleZ.toFixed(4)}]`);
                        console.log(`✅ 位移: [${positionX.toFixed(2)}, ${positionY.toFixed(2)}, ${positionZ.toFixed(2)}]`);

                        resolve({
                            url: dataUrl,  // 使用 data URL 而不是 Blob URL
                            scale: [scaleX, scaleX, scaleZ],
                            position: [positionX, positionY, positionZ],
                            rotation: [0, 0, 0]
                        });
                    }, undefined, (err) => {
                        console.error('❌ 模型加载失败:', err);
                        reject(err);
                    });
                };

                reader.onerror = (err) => {
                    console.error('❌ 文件读取失败:', err);
                    reject(err);
                };

                // 开始读取文件为 data URL
                reader.readAsDataURL(file);

            } catch (error) {
                reject(error);
            }
        });
    }, []);


    // 切换场景
    // 使用useRef跟踪上一个场景ID，避免重复触发
    const prevFloorIdRef = useRef(null);
    
    useEffect(() => {
        if (!currentFloorId || floors.length === 0) return;

        // 只有当场景ID真正改变时才处理
        if (prevFloorIdRef.current === currentFloorId) {
            return;
        }
        
        prevFloorIdRef.current = currentFloorId;

        const floor = floors.find(f => f.id === currentFloorId);
        if (!floor) return;

        console.log('🔄 切换到场景:', floor.name);
        
        // 自动设置当前楼层为该场景的第一个楼层（只设置ID，不加载对象）
        // 对象加载由楼层切换的useEffect处理
        if (floor.floorLevels && floor.floorLevels.length > 0) {
            const firstFloor = floor.floorLevels[0];
            console.log('📍 设置当前楼层为:', firstFloor.name);
            setCurrentFloorLevelId(firstFloor.id);
        }
    }, [currentFloorId, floors]);
    
    // 🔑 新增：切换楼层时加载对应楼层的对象
    // 使用useRef跟踪上一个楼层ID，避免重复加载
    const prevFloorLevelIdRef = useRef(null);
    
    useEffect(() => {
        if (!currentFloorLevel) {
            console.log('⚠️ currentFloorLevel 为空');
            return;
        }
        
        // 只有当楼层ID真正改变时才加载对象
        if (prevFloorLevelIdRef.current === currentFloorLevel.id) {
            return;
        }
        
        prevFloorLevelIdRef.current = currentFloorLevel.id;
        
        console.log('🏢 切换到楼层:', currentFloorLevel.name, '| ID:', currentFloorLevel.id);
        
        // 加载当前楼层的对象
        let validObjects = [];
        
        if (currentFloorLevel.objects && currentFloorLevel.objects.length > 0) {
            // 过滤掉null和undefined
            validObjects = currentFloorLevel.objects.filter(obj => obj != null);
            console.log('✅ 从楼层恢复对象:', validObjects.length, '(原始:', currentFloorLevel.objects.length, ')');
        } else {
            console.log('📭 当前楼层没有对象');
        }
        
        // 🔑 如果楼层有SLAM底图数据，创建底图对象
        if (currentFloorLevel.baseMapData) {
            console.log('🗺️ 楼层有SLAM底图，创建底图对象');
            const mapData = currentFloorLevel.baseMapData;
            const mapWidth = mapData.actualSize.width * mapData.resolution;
            const mapHeight = mapData.actualSize.height * mapData.resolution;
            
            const baseMapObj = {
                id: `map_${currentFloorLevel.id}`,
                type: 'map_image',
                name: mapData.name || 'SLAM底图',
                position: [0, 0.1, 0], // 🔑 Y=0.1，稍微高于地面
                rotation: [-Math.PI / 2, 0, 0],
                scale: [mapWidth, 1, mapHeight],
                color: '#ffffff',
                opacity: 0.5, // 半透明
                visible: currentFloorLevel.showBaseMap !== false, // 根据楼层配置决定是否显示
                locked: false,
                isBaseMap: true,
                imageData: mapData.imageUrl || mapData.imageData
            };
            
            console.log('🗺️ 从楼层数据创建底图对象:', baseMapObj);
            
            // 检查是否已经有这个底图对象
            const hasBaseMap = validObjects.some(obj => obj.id === baseMapObj.id);
            if (!hasBaseMap) {
                validObjects.push(baseMapObj);
                console.log('✅ 已添加SLAM底图对象到场景');
            }
        }
        
        // 如果楼层有3D模型数据，创建模型对象
        if (currentFloorLevel.sceneModelData) {
            console.log('🏗️ 楼层有3D模型，创建模型对象');
            const modelObj = {
                id: `model_${currentFloorLevel.id}`,
                type: 'custom_model',
                name: currentFloorLevel.sceneModelData.fileName || '3D底图模型',
                locked: true, // 🔒 锁定模型，不允许修改
                modelUrl: currentFloorLevel.sceneModelData.url,
                modelScale: 1,
                position: currentFloorLevel.sceneModelData.position || [0, 0, 0],
                scale: currentFloorLevel.sceneModelData.scale || [1, 1, 1],
                rotation: [0, 0, 0],
                visible: true,
                opacity: 1,
                color: '#ffffff'
            };
            
            console.log('🏗️ 从楼层数据创建模型对象:', modelObj);
            
            // 检查是否已经有这个模型对象
            const hasModel = validObjects.some(obj => obj.id === modelObj.id);
            if (!hasModel) {
                validObjects.push(modelObj);
                console.log('✅ 已添加3D模型对象到场景');
            }
        }
        
        setObjects(validObjects);
        setHistory([validObjects]);
        setHistoryIndex(0);
    }, [currentFloorLevel]);
    

    // 🔑 修改：自动保存当前楼层的对象数据
    useEffect(() => {
        if (!currentFloorId || !currentFloorLevelId || floors.length === 0) return;

        const floor = floors.find(f => f.id === currentFloorId);
        if (!floor) return;
        
        const currentFloor = floor.floorLevels?.find(fl => fl.id === currentFloorLevelId);
        if (!currentFloor) return;

        // 更新当前楼层的对象数据
        const updatedFloors = floors.map(scene => {
            if (scene.id === currentFloorId) {
                return {
                    ...scene,
                    floorLevels: scene.floorLevels.map(fl => {
                        if (fl.id === currentFloorLevelId) {
                            return {
                                ...fl,
                                objects: objects
                            };
                        }
                        return fl;
                    })
                };
            }
            return scene;
        });

        // 只在对象真正变化时更新
        if (JSON.stringify(currentFloor.objects) !== JSON.stringify(objects)) {
            console.log('💾 自动保存楼层数据:', currentFloorLevel?.name, '对象数量:', objects.length);
            setFloors(updatedFloors);
        }
    }, [objects, currentFloorId, currentFloorLevelId]); // 当对象或楼层ID变化时执行

    const commitHistory = useCallback((newObjects) => { setObjects(newObjects); const newHistory = history.slice(0, historyIndex + 1); newHistory.push(newObjects); if (newHistory.length > 50) newHistory.shift(); setHistory(newHistory); setHistoryIndex(newHistory.length - 1); }, [history, historyIndex]);
    const undo = useCallback(() => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setObjects(history[newIndex]); } }, [history, historyIndex]);
    const redo = useCallback(() => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setObjects(history[newIndex]); } }, [history, historyIndex]);

    // 批量操作 Hook
    const {
        selectedObjects: batchSelected,
        setSelectedObjects: setBatchSelected,
        handleDelete: handleBatchDelete,
        handleDuplicate: handleBatchDuplicate,
        handleGroup: handleBatchGroup,
        handleUngroup: handleBatchUngroup,
        handleClear: handleBatchClear
    } = useBatchOperations(objects, setObjects, commitHistory);

    // 解组函数包装
    const handleUngroup = useCallback((groupId) => {
        const childIds = handleBatchUngroup(groupId);
        if (childIds && childIds.length > 0) {
            setSelectedIds(childIds);
            setSelectedId(childIds[0]);
        } else {
            setSelectedIds([]);
            setSelectedId(null);
        }
    }, [handleBatchUngroup]);

    // 自动保存到本地存储
    useEffect(() => {
        try {
            // 🔑 过滤掉GLB模型和底图的base64数据，只保存引用
            const floorsToSave = floors.map(scene => ({
                ...scene,
                floorLevels: scene.floorLevels.map(floor => {
                    const floorCopy = { ...floor };
                    
                    // 🔑 GLB模型已上传到Supabase，URL是HTTP URL，不需要过滤
                    
                    // 如果有baseMapData，只保存元数据，不保存图片base64
                    if (floorCopy.baseMapData && floorCopy.baseMapData.imageUrl?.startsWith('data:')) {
                        floorCopy.baseMapData = {
                            ...floorCopy.baseMapData,
                            imageUrl: null, // 不保存base64图片
                            _note: '已保存到Supabase'
                        };
                    }
                    
                    return floorCopy;
                })
            }));
            
            // 🔑 GLB模型已上传到Supabase，URL是HTTP URL，不需要过滤
            const objectsToSave = objects;
            
            const dataToSave = {
                floors: floorsToSave,
                currentFloorId,
                currentFloorLevelId,
                objects: objectsToSave,
                customAssets, // 保存自定义资产
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
            localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION); // 保存版本号
            console.log('💾 自动保存到本地存储 (v' + CURRENT_VERSION + ')');
        } catch (error) {
            console.error('❌ 保存到本地存储失败:', error);
            // 如果保存失败（可能是因为数据太大），尝试不保存自定义资产
            if (error.name === 'QuotaExceededError') {
                console.warn('⚠️ 存储空间不足，尝试不保存自定义资产...');
                try {
                    const dataToSave = {
                        floors: floorsToSave,
                        currentFloorId,
                        currentFloorLevelId,
                        objects: objectsToSave,
                        timestamp: new Date().toISOString()
                    };
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
                    localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION); // 保存版本号
                    console.log('💾 已保存（不包含自定义资产，v' + CURRENT_VERSION + '）');
                } catch (e) {
                    console.error('❌ 保存失败:', e);
                }
            }
        }
    }, [floors, currentFloorId, currentFloorLevelId, objects, customAssets]);

    // 同步批量选择状态
    useEffect(() => {
        setBatchSelected(batchSelectedObjects);
    }, [batchSelectedObjects, setBatchSelected]);

    // 同步 selectedIds 到 batchSelected（用于显示批量操作面板）
    useEffect(() => {
        if (selectedIds.length > 1) {
            const selectedObjects = objects.filter(o => selectedIds.includes(o.id));
            setBatchSelected(selectedObjects);
        } else {
            setBatchSelected([]);
        }
    }, [selectedIds, objects, setBatchSelected]);

    // 复制选中对象
    const copySelected = useCallback(() => {
        if (selectedIds.length === 0) return;
        
        // 收集所有需要复制的对象（包括组对象的子对象）
        const objectsToCopy = new Set();
        const selectedObjects = objects.filter(o => selectedIds.includes(o.id) && !o.isBaseMap);
        
        selectedObjects.forEach(obj => {
            objectsToCopy.add(obj);
            
            // 如果是组对象，添加所有子对象
            if (obj.type === 'group' && obj.children) {
                obj.children.forEach(childId => {
                    const childObj = objects.find(o => o.id === childId);
                    if (childObj) {
                        objectsToCopy.add(childObj);
                    }
                });
            }
        });
        
        const allObjectsToCopy = Array.from(objectsToCopy);
        if (allObjectsToCopy.length > 0) {
            setClipboard(allObjectsToCopy);
            console.log('Copied to clipboard:', allObjectsToCopy);
        }
    }, [objects, selectedIds]);

    // 粘贴对象
    const pasteClipboard = useCallback(() => {
        if (clipboard.length === 0) return;

        const idMapping = {}; // 用于映射旧ID到新ID
        const newObjects = [];
        
        // 第一遍：创建所有新对象并建立ID映射
        clipboard.forEach(obj => {
            const newId = uuidv4();
            idMapping[obj.id] = newId;
            
            const newObj = {
                ...obj,
                id: newId,
                name: `${obj.name} (Copy)`,
                position: [...obj.position] // 原位粘贴，保持相同位置
            };
            
            newObjects.push(newObj);
        });
        
        // 第二遍：更新所有的parentId和children引用
        newObjects.forEach(obj => {
            // 如果是组对象，更新children的ID映射
            if (obj.type === 'group' && obj.children) {
                obj.children = obj.children.map(childId => idMapping[childId] || childId);
            }
            
            // 如果有父对象，更新parentId
            if (obj.parentId && idMapping[obj.parentId]) {
                obj.parentId = idMapping[obj.parentId];
            }
        });

        const newAllObjects = [...objects, ...newObjects];
        commitHistory(newAllObjects);

        // 选中新粘贴的对象（只选中顶层对象，不包括子对象）
        const topLevelIds = newObjects
            .filter(obj => !obj.parentId || !idMapping[obj.parentId])
            .map(o => o.id);
        setSelectedIds(topLevelIds);
        setSelectedId(topLevelIds[topLevelIds.length - 1]);

        console.log('Pasted objects:', newObjects);
    }, [clipboard, objects, commitHistory]);

    // 开始编辑对象名称
    const startEditingName = useCallback((id, currentName) => {
        setEditingNameId(id);
        setEditingName(currentName);
    }, []);

    // 保存编辑的名称
    const saveEditingName = useCallback(() => {
        if (editingNameId && editingName.trim()) {
            const updatedObjects = objects.map(obj =>
                obj.id === editingNameId ? { ...obj, name: editingName.trim() } : obj
            );
            commitHistory(updatedObjects);
        }
        setEditingNameId(null);
        setEditingName('');
    }, [editingNameId, editingName, objects, commitHistory]);

    // 取消编辑名称
    const cancelEditingName = useCallback(() => {
        setEditingNameId(null);
        setEditingName('');
    }, []);

    // 处理对象选择
    const handleSelect = useCallback((id, multiSelect = false, ctrlKey = false) => {
        if (toolMode !== 'select') return;

        // 检查对象是否属于其他楼层，如果是则不允许选择
        const obj = objects.find(o => o.id === id);
        if (obj && obj.floorLevel && currentFloorLevel && obj.floorLevel !== currentFloorLevel.name) {
            console.log('⚠️ 无法选择其他楼层的对象');
            return;
        }

        let idsToSelect = [id];
        
        // 场景E：Ctrl+点击 - 穿透选择子对象（忽略父组）
        if (ctrlKey && obj && obj.parentId) {
            console.log('🎯 穿透选择子对象:', id);
            idsToSelect = [id];
        }
        // 场景D：默认点击有parentId的对象 - 选中最顶层父组
        else if (obj && obj.parentId && !multiSelect) {
            // 向上追溯找到最顶层的父组
            let topParent = obj;
            let currentParent = objects.find(o => o.id === obj.parentId);
            while (currentParent) {
                topParent = currentParent;
                currentParent = objects.find(o => o.id === currentParent.parentId);
            }
            console.log('📦 自动选中顶层父组:', topParent.id, topParent.name);
            idsToSelect = [topParent.id];
            // 只选中组本身，不自动选中子对象
        }
        // 选择组对象 - 只选中组本身
        else if (obj && obj.type === 'group') {
            idsToSelect = [id];
            console.log('📦 选中组对象:', obj.name, '| multiSelect:', multiSelect);
        }

        console.log('🔍 handleSelect:', {
            objName: obj?.name,
            objType: obj?.type,
            multiSelect,
            idsToSelect,
            currentSelectedIds: selectedIds
        });

        if (multiSelect) {
            const newIds = selectedIds.includes(id)
                ? selectedIds.filter(i => !idsToSelect.includes(i)) // 取消选择
                : [...selectedIds, ...idsToSelect]; // 添加选择
            console.log('✅ 多选结果:', newIds.map(id => objects.find(o => o.id === id)?.name));
            setSelectedIds(newIds);
            setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
        } else {
            console.log('✅ 单选结果:', idsToSelect.map(id => objects.find(o => o.id === id)?.name));
            setSelectedIds(idsToSelect);
            setSelectedId(idsToSelect[0]); // 设置主选中ID为父组ID
        }
    }, [toolMode, selectedIds, objects, currentFloorLevel]);

    useEffect(() => { setIsEditingPoints(false); if (!selectedId) setTransformMode('translate'); }, [selectedId]);

    // 键盘快捷键处理
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 检查当前焦点是否在输入框中（使用 document.activeElement 更可靠）
            const activeEl = document.activeElement;
            const isInInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
            
            // 如果在输入框中，只允许ESC键
            if (isInInput && e.key !== 'Escape') {
                return;
            }
            
            // ESC 键：取消绘制模式，退出编辑模式，清除选择
            if (e.key === 'Escape') {
                if (toolMode !== 'select') {
                    setToolMode('select');
                } else if (isEditingPoints) {
                    setIsEditingPoints(false);
                } else if (selectedIds.length > 0) {
                    setSelectedId(null);
                    setSelectedIds([]);
                }
            }

            // Cmd/Ctrl + G: 组合对象
            if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
                e.preventDefault();
                if (selectedIds.length >= 2) {
                    const groupId = handleBatchGroup(selectedIds);
                    if (groupId) {
                        setSelectedIds([groupId]);
                        setSelectedId(groupId);
                    }
                }
            }

            // Cmd/Ctrl + Shift + G: 解组对象
            if ((e.metaKey || e.ctrlKey) && e.key === 'G' && e.shiftKey) {
                e.preventDefault();
                if (selectedIds.length === 1) {
                    const selectedObj = objects.find(o => o.id === selectedIds[0]);
                    if (selectedObj && selectedObj.type === 'group') {
                        handleUngroup(selectedObj.id);
                    }
                }
            }

            // 变换模式快捷键（只在有选中对象时生效）
            if (selectedIds.length > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                if (e.key === 'w' || e.key === 'W') {
                    e.preventDefault();
                    setTransformMode('translate');
                    console.log('🔧 切换到移动模式');
                } else if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    setTransformMode('rotate');
                    console.log('🔧 切换到旋转模式');
                } else if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    setTransformMode('scale');
                    console.log('🔧 切换到缩放模式');
                }
            }

            // 视图缩放快捷键
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                handleZoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                handleZoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                handleZoomFit();
            }

            // 删除快捷键
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
                e.preventDefault();
                handleBatchDelete(selectedIds);
                setSelectedIds([]);
                setSelectedId(null);
                console.log('🗑️ 删除选中的对象');
            }

            // 复制快捷键
            if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedIds.length > 0) {
                e.preventDefault();
                handleBatchDuplicate(selectedIds);
                console.log('📋 复制选中的对象');
            }

            // 全选快捷键
            if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                e.preventDefault();
                const allIds = objects.filter(o => !o.isBaseMap).map(o => o.id);
                setSelectedIds(allIds);
                setSelectedId(allIds[0]);
                console.log('✅ 全选所有对象');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toolMode, isEditingPoints, selectedIds, objects]);

    // 缩放控制函数
    const handleZoomIn = () => {
        setCameraZoom(prev => ({
            orthographic: Math.max(prev.orthographic * 0.8, 0.5), // 最小缩放0.5
            perspective: Math.max(prev.perspective * 0.8, 2)      // 最小距离2
        }));
    };

    const handleZoomOut = () => {
        setCameraZoom(prev => ({
            orthographic: Math.min(prev.orthographic * 1.25, 50), // 最大缩放50
            perspective: Math.min(prev.perspective * 1.25, 100)   // 最大距离100
        }));
    };

    const handleZoomFit = () => {
        // 重置到默认缩放级别
        setCameraZoom({
            orthographic: 5,
            perspective: 10
        });
    };

    const handleAddAsset = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // 检查文件大小（限制为10MB）
            if (file.size > 10 * 1024 * 1024) {
                alert('⚠️ 文件太大！请选择小于10MB的模型文件。');
                e.target.value = '';
                return;
            }

            // 将文件转换为Base64（用于持久化存储）
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Data = event.target.result;
                const newAsset = {
                    id: uuidv4(),
                    type: 'custom_model',
                    label: file.name.replace(/\.[^/.]+$/, ""),
                    icon: Box,
                    category: '自定义',
                    modelUrl: base64Data, // 使用Base64而不是blob URL
                    modelScale: 1,
                    rotationY: 0,
                    jsonData: '{\n  "description": "New Asset"\n}'
                };
                setCustomAssets([...customAssets, newAsset]);
                console.log('✅ 资产已添加:', newAsset.label);
            };
            reader.onerror = () => {
                alert('❌ 文件读取失败，请重试。');
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const handleUpdateAsset = (updatedAsset) => {
        // 更新资产库中的资产
        setCustomAssets(customAssets.map(a => a.id === updatedAsset.id ? updatedAsset : a));

        // 同步更新所有使用该资产的对象
        const updatedObjects = objects.map(obj => {
            // 检查对象是否使用了这个资产
            if (obj.assetId === updatedAsset.id || obj.modelUrl === updatedAsset.modelUrl) {
                console.log(`🔄 同步更新对象: ${obj.name}`);
                return {
                    ...obj,
                    modelScale: updatedAsset.modelScale || obj.modelScale,
                    // 可以选择是否同步其他属性
                    // modelUrl: updatedAsset.modelUrl,
                };
            }
            return obj;
        });

        // 如果有对象被更新，提交到历史记录
        if (updatedObjects.some((obj, idx) => obj !== objects[idx])) {
            commitHistory(updatedObjects);
            console.log('✅ 已同步更新所有使用该资产的对象');
        }

        setEditingAsset(null);
    };

    // 删除自定义资产
    const handleDeleteAsset = (asset) => {
        // 从资产库中删除
        setCustomAssets(customAssets.filter(a => a.id !== asset.id));
        
        // 重置所有使用该资产的对象为默认几何体
        const updatedObjects = objects.map(obj => {
            if (obj.assetId === asset.id || obj.modelUrl === asset.modelUrl) {
                console.log(`🔄 重置对象: ${obj.name}`);
                return {
                    ...obj,
                    type: 'cube',
                    modelUrl: null,
                    modelScale: 1,
                    assetId: undefined
                };
            }
            return obj;
        });
        
        commitHistory(updatedObjects);
        console.log('✅ 已删除资产:', asset.label);
    };

    // 导出自定义资产为.glb文件
    const handleExportAsset = (asset) => {
        try {
            // Base64转Blob
            const base64Data = asset.modelUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'model/gltf-binary' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset.label}.glb`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ 已导出资产:', asset.label);
        } catch (error) {
            console.error('❌ 导出失败:', error);
            alert('导出失败！请检查资产文件是否完整。');
        }
    };

    // 替换自定义资产的模型文件
    const handleReplaceAsset = (asset, file) => {
        if (file.size > 10 * 1024 * 1024) {
            alert('⚠️ 文件太大！请选择小于10MB的模型文件。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            const updatedAsset = {
                ...asset,
                modelUrl: base64Data
            };
            
            // 更新资产库
            setCustomAssets(customAssets.map(a => a.id === asset.id ? updatedAsset : a));
            
            // 同步更新所有使用该资产的对象
            const updatedObjects = objects.map(obj => {
                if (obj.assetId === asset.id) {
                    return {
                        ...obj,
                        modelUrl: base64Data
                    };
                }
                return obj;
            });
            
            commitHistory(updatedObjects);
            console.log('✅ 已替换资产模型:', asset.label);
            alert(`✅ 已替换"${asset.label}"的模型文件`);
        };
        reader.onerror = () => {
            alert('❌ 文件读取失败！');
        };
        reader.readAsDataURL(file);
    };

    // 内置地图模板
    const builtInMapTemplates = [
        {
            id: 'map_1_5',
            name: '1.5 场景地图',
            description: '包含CNC加工中心、电梯、货梯等点位（完整SLAM地图）',
            // 使用外部JSON文件（包含完整的地图图片）
            externalFile: './1.5_地图_1763709378606.json',
            // 备用的简化数据（如果外部文件加载失败）
            data: {
                mapfileEntitys: [],
                graphTopologys: [
                    {
                        graph: {
                            name: "示例地图",
                            description: "演示用地图"
                        },
                        poses: [
                            {
                                name: "CNC工位1",
                                x: -5,
                                y: 0,
                                yaw: 0,
                                uid: 1001,
                                parkable: false,
                                dockable: false
                            },
                            {
                                name: "CNC工位2",
                                x: -3,
                                y: 0,
                                yaw: 0,
                                uid: 1002,
                                parkable: false,
                                dockable: false
                            },
                            {
                                name: "CNC工位3",
                                x: -1,
                                y: 0,
                                yaw: 0,
                                uid: 1003,
                                parkable: false,
                                dockable: false
                            },
                            {
                                name: "装卸点A",
                                x: 3,
                                y: 2,
                                yaw: -1.57,
                                uid: 1004,
                                parkable: true,
                                dockable: false
                            },
                            {
                                name: "装卸点B",
                                x: 3,
                                y: -2,
                                yaw: -1.57,
                                uid: 1005,
                                parkable: true,
                                dockable: false
                            },
                            {
                                name: "电梯点位",
                                x: 0,
                                y: 5,
                                yaw: -1.57,
                                uid: 1006,
                                parkable: false,
                                dockable: true
                            }
                        ],
                        paths: [
                            {
                                name: "路径1",
                                sourceName: "CNC工位1",
                                targetName: "CNC工位2",
                                bidirectional: true,
                                uid: 2001
                            },
                            {
                                name: "路径2",
                                sourceName: "CNC工位2",
                                targetName: "CNC工位3",
                                bidirectional: true,
                                uid: 2002
                            },
                            {
                                name: "路径3",
                                sourceName: "CNC工位3",
                                targetName: "装卸点A",
                                bidirectional: true,
                                uid: 2003
                            },
                            {
                                name: "路径4",
                                sourceName: "装卸点A",
                                targetName: "装卸点B",
                                bidirectional: true,
                                uid: 2004
                            },
                            {
                                name: "路径5",
                                sourceName: "装卸点B",
                                targetName: "电梯点位",
                                bidirectional: true,
                                uid: 2005
                            }
                        ]
                    }
                ]
            }
        }
    ];

    // 加载内置地图
    const loadBuiltInMap = async (templateId) => {
        const template = builtInMapTemplates.find(t => t.id === templateId);
        if (!template) return;

        try {
            // 检查是否有现有数据
            const hasExistingData = objects.some(obj => obj.type === 'waypoint' || obj.type === 'map_image');

            if (hasExistingData) {
                const preserveBindings = window.confirm(
                    '⚠️ 检测到现有路网地图数据！\n\n' +
                    '是否保留原孪生点位绑定？\n\n' +
                    '• 点击"确定"：保留现有绑定关系\n' +
                    '• 点击"取消"：清除所有数据并重新导入'
                );

                if (!preserveBindings) {
                    // 清除所有地图相关数据
                    const filteredObjects = objects.filter(obj =>
                        obj.type !== 'waypoint' &&
                        obj.type !== 'map_image' &&
                        obj.type !== 'path_line'
                    );
                    setObjects(filteredObjects);
                }
            }

            // 如果模板有外部文件路径，则加载外部文件
            let mapData = template.data;
            if (template.externalFile) {
                console.log('🔄 正在加载外部地图文件:', template.externalFile);
                try {
                    const response = await fetch(template.externalFile);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    mapData = await response.json();
                    console.log('✅ 外部地图文件加载成功');
                    console.log('地图数据:', {
                        mapfileEntitys: mapData.mapfileEntitys?.length || 0,
                        poses: mapData.graphTopologys?.[0]?.poses?.length || 0,
                        hasImageData: !!mapData.mapfileEntitys?.[0]?.content
                    });
                } catch (fetchError) {
                    console.error('❌ 加载外部文件失败:', fetchError);
                    console.warn('⚠️ 使用备用数据');
                    // 继续使用 template.data 作为备用
                }
            }

            // 使用地图数据
            loadMapFromJSON(mapData);

            alert(`✅ 地图"${template.name}"加载成功！`);
            setShowMapSelector(false);
        } catch (error) {
            console.error('加载内置地图失败:', error);
            alert('❌ 地图加载失败：' + error.message);
        }
    };

    // 批量替换选中对象的模型
    const batchReplaceWaypointModels = (modelType, customAsset = null) => {
        // 支持所有可替换模型的对象类型
        const replaceableTypes = ['waypoint', 'cube', 'cnc', 'column', 'door', 'custom_model'];
        const replaceableIds = selectedIds.filter(id => {
            const obj = objects.find(o => o.id === id);
            return obj && replaceableTypes.includes(obj.type);
        });

        if (replaceableIds.length === 0) {
            alert('请先选择要替换的对象！');
            return;
        }

        let asset, modelUrl, modelScale, assetLabel;

        if (modelType === 'custom_model' && customAsset) {
            // 使用自定义资产
            asset = customAsset;
            modelUrl = customAsset.modelUrl;
            modelScale = customAsset.modelScale || 1;
            assetLabel = customAsset.label;
        } else {
            // 使用默认资产
            asset = defaultAssets.find(a => a.type === modelType);
            if (!asset) return;
            modelUrl = asset.modelUrl || null;
            modelScale = asset.modelScale || 1;
            assetLabel = asset.label;
        }

        const newObjects = objects.map(obj => {
            if (replaceableIds.includes(obj.id)) {
                return {
                    ...obj,
                    modelUrl: modelUrl,
                    modelScale: modelScale,
                    type: modelType, // 更新类型
                    name: `${assetLabel} - ${obj.name}`,
                    // 如果是自定义资产，保存资产ID以便后续同步
                    assetId: customAsset ? customAsset.id : undefined
                };
            }
            return obj;
        });

        commitHistory(newObjects);
        alert(`✅ 已将 ${replaceableIds.length} 个对象替换为"${assetLabel}"模型`);
    };

    // 从JSON加载地图数据 - 加载到当前楼层
    const loadMapFromJSON = (jsonData) => {
        console.log('🚀 ========== 开始加载地图数据到当前楼层 ==========');
        console.log('📋 当前场景:', currentScene?.name);
        console.log('📋 当前楼层:', currentFloorLevel?.name);
        console.log('📋 JSON数据结构:', jsonData);
        console.log('📋 JSON所有键:', Object.keys(jsonData));
        console.log('mapfileEntitys 数量:', jsonData.mapfileEntitys?.length || 0);
        console.log('graphTopologys 数量:', jsonData.graphTopologys?.length || 0);
        
        // 检测JSON格式类型
        let formatType = 'unknown';
        if (jsonData.mapfileEntitys || jsonData.graphTopologys) {
            formatType = 'legacy'; // 旧格式
        } else if (jsonData.imageData && jsonData.resolution) {
            formatType = 'new'; // 新格式（单个地图对象）
        }
        
        console.log('📋 检测到的格式类型:', formatType);
        
        if (formatType === 'unknown') {
            console.error('❌ JSON数据格式无法识别！');
            console.error('实际的字段:', Object.keys(jsonData));
            alert('❌ JSON数据格式不正确\n\n未找到地图数据。支持的格式：\n1. 包含 mapfileEntitys 和 graphTopologys 的格式\n2. 包含 imageData 和 resolution 的地图对象');
            return;
        }
        
        if (!currentFloorLevel) {
            console.error('❌ 没有当前楼层，无法加载地图');
            alert('错误：没有当前楼层');
            return;
        }
        
        // 处理新格式
        if (formatType === 'new') {
            console.log('🆕 使用新格式加载地图');
            
            // 从URL加载图片
            const imageUrl = jsonData.imageData;
            const mapWidth = jsonData.actualSize.width * jsonData.resolution;
            const mapHeight = jsonData.actualSize.height * jsonData.resolution;
            
            console.log('📐 底图尺寸:', mapWidth, 'x', mapHeight, '米');
            console.log('📍 底图原点:', jsonData.origin);
            console.log('📍 底图居中在世界坐标 (0, 0, 0)');
            
            const baseMapObj = {
                id: `map_${jsonData.id}`,
                type: 'map_image',
                name: jsonData.name || '地图底图',
                position: [0, 0.1, 0], // 🔑 Y=0.1，稍微高于地面
                rotation: [0, 0, 0],
                scale: [mapWidth, 1, mapHeight],
                color: '#ffffff',
                opacity: 0.5, // 半透明，可以透过看到模型
                visible: true,
                locked: true,
                isBaseMap: true,
                imageData: imageUrl, // 使用URL而不是base64
                mapMetadata: jsonData
            };
            
            const newObjects = [baseMapObj];
            
            // 保存到楼层
            setFloors(prev => prev.map(scene => {
                if (scene.id === currentFloorId) {
                    return {
                        ...scene,
                        floorLevels: scene.floorLevels.map(floor => {
                            if (floor.id === currentFloorLevelId) {
                                console.log(`💾 将地图保存到楼层: ${floor.name}`);
                                return {
                                    ...floor,
                                    objects: newObjects,
                                    baseMapData: jsonData,
                                    serverUrl: floor.serverUrl || `http://${imageUrl.split('/')[2]}` // 提取服务器地址
                                };
                            }
                            return floor;
                        })
                    };
                }
                return scene;
            }));
            
            setObjects(newObjects);
            console.log('✅ 新格式地图加载完成！');
            console.log('💡 提示：点位和路径数据需要从服务器API获取');
            return;
        }
        
        // 处理旧格式
        if (jsonData.graphTopologys && jsonData.graphTopologys.length > 0) {
            console.log('📍 第一个topology的poses数量:', jsonData.graphTopologys[0].poses?.length || 0);
            console.log('🛤️ 第一个topology的paths数量:', jsonData.graphTopologys[0].paths?.length || 0);
        }

        const newObjects = [];
        const networkObjectIds = []; // 记录点位和路径的ID
        console.log('📦 当前对象数量:', objects.length);

        // 1. 加载底图
        let baseMapDataForGLB = null; // 保存底图数据供GLB使用
        
        if (jsonData.mapfileEntitys && jsonData.mapfileEntitys.length > 0) {
            jsonData.mapfileEntitys.forEach(mapEntity => {
                const record = mapEntity.record;
                const base64Image = mapEntity.content;

                console.log('📍 加载地图底图:', record.name);
                console.log('  - 尺寸:', record.width, 'x', record.height);
                console.log('  - 分辨率:', record.resolution);
                console.log('  - 原点:', record.origin);
                console.log('  - 图片数据长度:', base64Image?.length || 0);

                // 创建底图对象
                const mapWidth = record.width * record.resolution;
                const mapHeight = record.height * record.resolution;
                
                // 🔑 底图始终居中在世界坐标原点，不受origin影响
                // origin只用于GLB模型的对齐
                const baseMapObj = {
                    id: `map_${record.uid}`,
                    type: 'map_image',
                    name: record.name || '地图底图',
                    position: [0, 0.1, 0], // Y=0.1，稍微高于地面
                    rotation: [0, 0, 0],
                    scale: [mapWidth, 1, mapHeight],
                    color: '#ffffff',
                    opacity: 0.5, // 半透明
                    visible: true,
                    locked: true,
                    isBaseMap: true,
                    imageData: `data:image/png;base64,${base64Image}`,
                    mapMetadata: record
                };

                newObjects.push(baseMapObj);
                
                // 🔑 保存底图数据供GLB模型使用
                if (!baseMapDataForGLB) {
                    baseMapDataForGLB = {
                        actualSize: { width: mapWidth, height: mapHeight }, // 保存米为单位的尺寸
                        resolution: 1, // 已经转换为米，所以resolution是1
                        origin: record.origin
                    };
                }
            });
        }

        // 2. 加载点位 (poses)
        if (jsonData.graphTopologys && jsonData.graphTopologys.length > 0) {
            jsonData.graphTopologys.forEach(topology => {
                if (topology.poses) {
                    topology.poses.forEach(pose => {
                        const poseId = `pose_${pose.uid}`;
                        const poseObj = {
                            id: poseId,
                            type: 'waypoint',
                            name: pose.name || pose.alias,
                            position: [pose.x, 0.1, pose.y],
                            rotation: [0, pose.yaw, 0],
                            scale: [0.3, 0.3, 0.3],
                            color: pose.parkable ? '#4CAF50' : (pose.dockable ? '#2196F3' : '#FFC107'),
                            opacity: 1,
                            visible: true,
                            poseData: pose
                        };

                        newObjects.push(poseObj);
                        networkObjectIds.push(poseId); // 记录ID
                    });
                }

                // 3. 加载路径 (paths)
                if (topology.paths) {
                    topology.paths.forEach(path => {
                        // 找到起点和终点的pose
                        const sourcePose = topology.poses.find(p => p.name === path.sourceName);
                        const targetPose = topology.poses.find(p => p.name === path.targetName);

                        if (sourcePose && targetPose) {
                            const pathId = `path_${path.uid}`;
                            const pathObj = {
                                id: pathId,
                                type: 'path_line',
                                name: path.name || `路径 ${path.sourceName} -> ${path.targetName}`,
                                points: [
                                    { x: sourcePose.x, z: sourcePose.y },
                                    { x: targetPose.x, z: targetPose.y }
                                ],
                                position: [0, 0.05, 0],
                                rotation: [0, 0, 0],
                                scale: [1, 1, 1],
                                color: path.bidirectional ? '#00FF00' : '#FF9800',
                                opacity: 0.8,
                                visible: true,
                                pathData: path
                            };

                            newObjects.push(pathObj);
                            networkObjectIds.push(pathId); // 记录ID
                        }
                    });
                }
            });
        }

        // 4. 如果有点位或路径，创建场景组
        if (networkObjectIds.length > 0) {
            const groupId = uuidv4();
            
            // 计算所有点位和路径的中心位置
            const networkObjects = newObjects.filter(o => networkObjectIds.includes(o.id));
            let sumX = 0, sumZ = 0;
            networkObjects.forEach(obj => {
                sumX += obj.position[0];
                sumZ += obj.position[2];
            });
            const centerX = sumX / networkObjects.length;
            const centerZ = sumZ / networkObjects.length;
            
            // 创建组对象
            const sceneGroup = {
                id: groupId,
                type: 'group',
                name: '场景路网',
                position: [centerX, 0, centerZ],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                children: networkObjectIds, // 记录子对象ID列表
                color: '#888888',
                opacity: 1,
                visible: true,
                locked: false
            };
            
            // 将所有点位和路径设置为组的子对象
            networkObjectIds.forEach(objId => {
                const obj = newObjects.find(o => o.id === objId);
                if (obj) {
                    obj.parentId = groupId;
                    // 设置相对位置（相对于组中心）
                    obj.relativePosition = [
                        obj.position[0] - centerX,
                        obj.position[1] - 0, // 组的Y坐标是0
                        obj.position[2] - centerZ
                    ];
                }
            });
            
            newObjects.push(sceneGroup);
            console.log('📦 已创建场景路网组:', networkObjectIds.length, '个对象');
        }

        console.log('✅ 地图加载完成!');
        console.log('  - 总对象数:', newObjects.length);
        console.log('  - 地图底图:', newObjects.filter(o => o.type === 'map_image').length);
        console.log('  - 组对象:', newObjects.filter(o => o.type === 'group').length);
        console.log('  - 有parentId的对象:', newObjects.filter(o => o.parentId).length);
        
        // 输出组对象的详细信息
        const groups = newObjects.filter(o => o.type === 'group');
        groups.forEach(group => {
            const children = newObjects.filter(o => o.parentId === group.id);
            console.log(`📦 组"${group.name}":`, {
                id: group.id,
                position: group.position,
                children: children.length,
                childrenNames: children.map(c => c.name).slice(0, 5)
            });
        });
        
        console.log('  - Waypoint点位:', newObjects.filter(o => o.type === 'waypoint').length);
        console.log('  - 路径线:', newObjects.filter(o => o.type === 'path_line').length);

        // 输出第一个地图对象的详细信息
        const mapObj = newObjects.find(o => o.type === 'map_image');
        if (mapObj) {
            console.log('🗺️ 地图对象详情:', {
                id: mapObj.id,
                name: mapObj.name,
                position: mapObj.position,
                scale: mapObj.scale,
                hasImageData: !!mapObj.imageData,
                imageDataPrefix: mapObj.imageData?.substring(0, 50)
            });
        }
        
        // 🔑 关键改动：将对象保存到当前楼层，而不是全局objects
        setFloors(prev => prev.map(scene => {
            if (scene.id === currentFloorId) {
                return {
                    ...scene,
                    floorLevels: scene.floorLevels.map(floor => {
                        if (floor.id === currentFloorLevelId) {
                            console.log(`💾 将 ${newObjects.length} 个对象保存到楼层: ${floor.name}`);
                            
                            // 💾 保存底图数据到Supabase
                            if (baseMapDataForGLB) {
                                console.log('📤 准备保存底图数据到Supabase:', {
                                    floorId: floor.id,
                                    hasImageUrl: !!baseMapDataForGLB.imageUrl,
                                    origin: baseMapDataForGLB.origin,
                                    resolution: baseMapDataForGLB.resolution,
                                    actualSize: baseMapDataForGLB.actualSize
                                });
                                
                                saveBaseMap(floor.id, {
                                    imageUrl: baseMapDataForGLB.imageUrl,
                                    origin: baseMapDataForGLB.origin,
                                    resolution: baseMapDataForGLB.resolution,
                                    actualSize: baseMapDataForGLB.actualSize
                                }).then(() => {
                                    console.log('✅ 底图数据已保存到Supabase');
                                }).catch(error => {
                                    console.error('❌ 保存底图数据到Supabase失败:', error);
                                    console.error('错误详情:', JSON.stringify(error, null, 2));
                                });
                            }
                            
                            return {
                                ...floor,
                                objects: newObjects,
                                baseMapData: baseMapDataForGLB, // 🔑 保存处理后的底图数据供GLB使用
                                waypointsData: jsonData.graphTopologys?.[0]?.poses || null,
                                pathsData: jsonData.graphTopologys?.[0]?.paths || null
                            };
                        }
                        return floor;
                    })
                };
            }
            return scene;
        }));
        
        // 同时更新当前显示的objects
        setObjects(newObjects);
        
        console.log('✅ 地图数据已保存到当前楼层');
    };

    // Helper to create a new point object
    const createPoint = (position) => ({
        id: uuidv4(),
        type: 'point',
        name: `点 ${objects.filter(o => o.type === 'point').length + 1}`,
        position: [position.x, position.y, position.z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#10b981', // Green for points
        visible: true,
        locked: false,
        isBaseMap: false,
    });

    // Helper to create a new path object

    // SLAM Map Upload Handler
    const handleSLAMUpload = async () => {
        const yamlFile = slamYamlInputRef.current?.files[0];
        const imageFile = slamImageInputRef.current?.files[0];

        if (!yamlFile || !imageFile) {
            alert('请同时选择 YAML 配置文件和地图图片！');
            return;
        }

        try {
            // Read YAML file
            const yamlText = await yamlFile.text();

            // Read image file and create object URL
            const imageUrl = URL.createObjectURL(imageFile);

            // Get image dimensions
            const img = new Image();
            img.src = imageUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Parse SLAM config
            const slamConfig = parseSLAMConfig(yamlText, imageUrl);
            slamConfig.widthPx = img.width;
            slamConfig.heightPx = img.height;

            // Create base map
            const baseMap = createBaseMap(slamConfig);

            // Remove existing base maps and add new one
            const newObjects = objects.filter(o => !o.isBaseMap);
            commitHistory([baseMap, ...newObjects]);

            // Close modal
            setShowSLAMUpload(false);

            // Reset file inputs
            if (slamYamlInputRef.current) slamYamlInputRef.current.value = '';
            if (slamImageInputRef.current) slamImageInputRef.current.value = '';

            console.log('✅ SLAM 地图上传成功！', baseMap);
        } catch (error) {
            console.error('SLAM 上传失败:', error);
            alert('SLAM 地图上传失败，请检查文件格式！');
        }
    };
    // JSON Project Import Handler
    const handleJSONImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            console.log('📄 导入的 JSON 数据:', json);

            // 检测是否是地图JSON（包含mapfileEntitys和graphTopologys）
            if (json.mapfileEntitys || json.graphTopologys) {
                console.log('🗺️ 检测到地图JSON，开始加载...');
                loadMapFromJSON(json);
                alert('✅ 地图导入成功！\n已加载底图、点位和路径。');
                e.target.value = '';
                return;
            }

            // 如果不是地图JSON，提示用户
            alert('JSON 导入完成！请查看控制台了解详细数据结构。');
        } catch (error) {
            console.error('JSON 导入失败:', error);
            alert('JSON 文件解析失败！');
        } finally {
            if (jsonImportRef.current) jsonImportRef.current.value = '';
        }
    };
    const handleDrop = (type, position, assetId) => {
        let defaultScale = [1, 1, 1];
        let name = 'Object';
        let color = '#cccccc';
        let yOffset = 0.5;
        let modelUrl = null;
        let modelScale = 1;
        let initialRot = [0, 0, 0];

        if (type === 'custom_model') {
            const sourceAsset = customAssets.find(a => a.id === assetId);
            if (sourceAsset) {
                name = sourceAsset.label;
                color = '#ffffff';
                yOffset = 0;
                modelUrl = sourceAsset.modelUrl;
                modelScale = sourceAsset.modelScale || 1;
                initialRot = [0, (sourceAsset.rotationY || 0) * Math.PI / 180, 0];
            }
        } else {
            switch (type) {
                case 'wall':
                    defaultScale = [4, 3, 0.2];
                    name = '标准墙体';
                    yOffset = 1.5;
                    break;
                case 'floor':
                    defaultScale = [10, 0.1, 10];
                    name = '标准地面';
                    color = '#222';
                    yOffset = 0;
                    break;
                case 'column':
                    defaultScale = [0.6, 4, 0.6];
                    name = '标准柱子';
                    yOffset = 2;
                    break;
                case 'cube':
                    defaultScale = [1, 1, 1];
                    name = '占位方块';
                    color = '#888888';
                    yOffset = 0.5;
                    break;
                case 'cnc':
                    // 使用保存的CNC配置
                    defaultScale = defaultAssetConfigs.cnc?.scale || [1, 1, 1];
                    name = 'CNC加工中心';
                    color = '#3b82f6';
                    yOffset = 0;
                    modelUrl = `${import.meta.env.BASE_URL}cnc.glb`;  // 预置CNC模型
                    modelScale = defaultAssetConfigs.cnc?.modelScale || 1;
                    console.log('📦 使用CNC配置:', defaultAssetConfigs.cnc);
                    break;
                case 'door':
                    defaultScale = [1.2, 2.2, 0.15];
                    name = '标准门';
                    color = '#555';
                    yOffset = 1.1;
                    break;
            }
        }

        const newObj = {
            id: uuidv4(),
            type,
            name: `${name} ${objects.length + 1}`,
            position: [position[0], yOffset, position[2]],
            rotation: initialRot,
            scale: defaultScale,
            color,
            opacity: 1,
            visible: true,
            modelUrl: modelUrl,
            modelScale: modelScale,
            // 保存资产ID以便后续同步
            assetId: type === 'custom_model' ? assetId : undefined,
            // 🏢 标记当前楼层
            floorLevel: currentFloorLevel?.name || '1F'
        };

        commitHistory([...objects, newObj]);
        setSelectedId(newObj.id);
    };

    const handleDrawFinish = (data) => {
        let newObj = {
            id: uuidv4(),
            color: '#8b5cf6',
            visible: true,
            opacity: 1,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            floorLevel: currentFloorLevel?.name || '1F', // 🏢 标记当前楼层
            ...data
        };
        if (data.type === 'wall_path') {
            const center = calculateCenter(data.points);
            newObj.position = [center.x, 0, center.z];
            newObj.points = localizePoints(data.points, center);
            newObj.name = '连续直墙';
            newObj.type = 'curved_wall';
            newObj.color = '#8b5cf6';
            newObj.height = 3;
            newObj.thickness = 0.2;
            newObj.tension = 0;
            newObj.closed = false;
            commitHistory([...objects, newObj]);
            setSelectedId(newObj.id);
        } else if (data.type === 'curved_wall' || data.type === 'polygon_floor') {
            const center = calculateCenter(data.points);
            newObj.position = [center.x, data.type === 'polygon_floor' ? 0.01 : 0, center.z];
            newObj.points = localizePoints(data.points, center);
            newObj.name = data.type === 'curved_wall' ? '连续曲线墙' : '多边形地面';
            newObj.color = data.type === 'curved_wall' ? '#d946ef' : '#334155';
            if (data.type === 'curved_wall') {
                newObj.height = 3;
                newObj.thickness = 0.2;
                newObj.tension = 0.5;
            }
            commitHistory([...objects, newObj]);
            setSelectedId(newObj.id);
        } else if (data.type === 'wall') {
            const dx = data.end.x - data.start.x;
            const dz = data.end.z - data.start.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const angle = -Math.atan2(dz, dx);
            newObj.name = '绘制墙体';
            newObj.position = [(data.start.x + data.end.x) / 2, 1.5, (data.start.z + data.end.z) / 2];
            newObj.rotation = [0, angle, 0];
            newObj.scale = [len, 3, 0.2];
            commitHistory([...objects, newObj]);
            setSelectedId(newObj.id);
        }
        setToolMode('select');
        setTransformMode('translate');
    };

    const snapObjectToGround = () => {
        // 支持单选和多选
        const targetIds = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
        if (targetIds.length === 0) return;
        
        const newObjects = objects.map(obj => {
            if (!targetIds.includes(obj.id)) return obj;
            
            // 路径类型：将所有点的Y坐标设置为0.1（稍微高于地面）
            if (obj.type === 'path') {
                return {
                    ...obj,
                    points: obj.points.map(point => [point[0], 0.1, point[2]])
                };
            }
            
            let newY = 0;
            
            // 根据物体类型计算底部应该在地面的Y坐标
            if (obj.type === 'floor') {
                newY = -0.11;  // 地面稍微低一点
            } else if (obj.type === 'polygon_floor') {
                newY = 0.01;
            } else if (['wall', 'column', 'door', 'cube'].includes(obj.type)) {
                // 这些物体的原点在中心，需要抬高半个高度
                newY = obj.scale[1] / 2;
            } else if (obj.type === 'cnc' || (obj.type === 'custom_model' && obj.modelUrl)) {
                // CNC和自定义模型的原点通常在底部
                newY = 0;
            } else if (obj.type === 'waypoint' || obj.type === 'point') {
                // 点位放在地面上，稍微高一点以便可见
                newY = 0.1;
            } else {
                // 其他物体放在地面上
                newY = 0;
            }
            
            const newPos = [...obj.position];
            newPos[1] = newY;
            return { ...obj, position: newPos };
        });
        commitHistory(newObjects);
        
        console.log(`✅ 已将 ${targetIds.length} 个对象置于地面`);
    };

    const updateObject = (id, key, value) => {
        const obj = objects.find(o => o.id === id);

        // 如果修改的是CNC等默认资产的scale，询问是否要更新资产定义
        if (obj && key === 'scale' && obj.type === 'cnc') {
            const shouldUpdateAsset = window.confirm(
                '是否要将此尺寸应用到CNC资产库？\n\n' +
                '选择"确定"：以后添加的CNC都会使用新尺寸\n' +
                '选择"取消"：只修改当前对象'
            );

            if (shouldUpdateAsset) {
                setDefaultAssetConfigs(prev => ({
                    ...prev,
                    cnc: { ...prev.cnc, scale: value }
                }));
                console.log('✅ 已更新CNC资产库配置:', value);
            }
        }

        const newObjects = objects.map(o => o.id === id ? { ...o, [key]: value } : o);
        commitHistory(newObjects);
    };

    const handleTransformEnd = (id, newTransform) => {
        const newObjects = objects.map(o => {
            if (o.id !== id) return o;
            return { ...o, ...newTransform };
        });
        commitHistory(newObjects);
    };

    const updateTransform = (id, type, axisIdx, value) => {
        // 直接使用传入的值，不做任何处理
        // 最小值限制已经在SmartInput组件中处理
        const newObjects = objects.map(o => {
            if (o.id !== id) return o;
            const newArr = [...o[type]];
            newArr[axisIdx] = value;
            return { ...o, [type]: newArr };
        });
        commitHistory(newObjects);
    };

    const updatePoints = (id, newPoints, commit = false) => {
        const currentObj = objects.find(o => o.id === id);
        const worldPoints = newPoints.map(p => ({ x: p.x + currentObj.position[0], z: p.z + currentObj.position[2] }));
        const newCenter = calculateCenter(worldPoints);
        const newLocalPoints = localizePoints(worldPoints, newCenter);
        const newObjects = objects.map(o => o.id === id ? { ...o, points: newLocalPoints, position: [newCenter.x, o.position[1], newCenter.z] } : o);
        commit ? commitHistory(newObjects) : setObjects(newObjects);
    };

    const deleteSelected = () => {
        if (selectedIds.length > 0) {
            // 过滤掉基础地图，不允许删除
            const newObjects = objects.filter(o => !selectedIds.includes(o.id) || o.isBaseMap);
            commitHistory(newObjects);
            setSelectedId(null);
            setSelectedIds([]);
        } else if (selectedId) {
            const selectedObj = objects.find(o => o.id === selectedId);
            // 如果是基础地图，不允许删除
            if (selectedObj?.isBaseMap) return;
            const newObjects = objects.filter(o => o.id !== selectedId);
            commitHistory(newObjects);
            setSelectedId(null);
        }
    };

    // 初始化 lastSavedState
    useEffect(() => {
        if (lastSavedState === null && objects.length > 0) {
            setLastSavedState(JSON.stringify({ floors, objects }));
        }
    }, [lastSavedState, floors, objects]);

    // 监测对象变化，标记为未保存
    useEffect(() => {
        if (lastSavedState) {
            const currentState = JSON.stringify({ floors, objects });
            if (currentState !== lastSavedState) {
                console.log('🔄 检测到未保存的更改');
                setHasUnsavedChanges(true);
            }
        }
    }, [objects, floors, lastSavedState]);

    // 关闭网页时提醒未保存
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            console.log('🚪 beforeunload 触发, hasUnsavedChanges:', hasUnsavedChanges);
            if (hasUnsavedChanges) {
                // 标准做法：设置 returnValue
                const message = '您有未保存的更改，确定要离开吗？';
                e.preventDefault();
                e.returnValue = message;
                console.log('⚠️ 阻止关闭，显示确认对话框');
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        console.log('✅ beforeunload 监听器已添加, hasUnsavedChanges:', hasUnsavedChanges);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            console.log('🗑️ beforeunload 监听器已移除');
        };
    }, [hasUnsavedChanges]);

    // Keyboard Shortcuts Effect - Moved here to ensure all functions are defined
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 检查当前焦点是否在输入框中（使用 document.activeElement 更可靠）
            const activeEl = document.activeElement;
            const isInInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
            
            // 如果在输入框中，只允许 Ctrl+S 保存
            if (isInInput) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveCurrentScene();
                }
                return; // 其他快捷键都不处理
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }

            // 复制 Ctrl+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                copySelected();
            }

            // 粘贴 Ctrl+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                pasteClipboard();
            }

            // 保存 Ctrl+S
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCurrentScene();
            }

            if (e.key === 'Escape') {
                setIsPreviewMode(false);
                setSelectedId(null);
                setSelectedIds([]);
            } // ESC 退出预览并清空选择

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelected();
            } // Delete/Backspace 删除选中对象
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, deleteSelected, copySelected, pasteClipboard, saveCurrentScene]);

    const handleMultiTransformEnd = (updatedObjects) => {
        // 批量更新所有对象并提交到历史记录
        commitHistory(updatedObjects);
    };

    // 多选拖动处理函数
    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDrag = (offset) => {
        dragOffsetRef.current = offset;
        // 使用 requestAnimationFrame 节流更新，并添加时间间隔控制
        const now = performance.now();
        if (!dragOffsetRef.lastUpdateTime) {
            dragOffsetRef.lastUpdateTime = now;
        }
        
        // 限制更新频率为每16ms一次（约60fps）
        if (!dragOffsetRef.updateScheduled && (now - dragOffsetRef.lastUpdateTime) >= 16) {
            dragOffsetRef.updateScheduled = true;
            requestAnimationFrame(() => {
                setDragOffset(dragOffsetRef.current);
                dragOffsetRef.updateScheduled = false;
                dragOffsetRef.lastUpdateTime = performance.now();
            });
        }
    };

    const handleDragEnd = () => {
        const finalOffset = dragOffsetRef.current || dragOffset;
        
        if (finalOffset && selectedIds.length > 0) {
            console.log('🎯 handleDragEnd:', {
                finalOffset,
                selectedIds,
                selectedObjects: objects.filter(o => selectedIds.includes(o.id)).map(o => ({
                    id: o.id,
                    name: o.name,
                    type: o.type,
                    parentId: o.parentId,
                    position: o.position,
                    relativePosition: o.relativePosition
                }))
            });
            // 场景C：层级过滤 - 如果父组和子对象都被选中，只移动父组
            // 场景A：仅选中组 - 只移动组对象
            // 场景B：仅选中子对象 - 更新子对象的relativePosition
            // 场景G：混合选择 - 子对象更新relativePosition，独立对象更新position
            
            const updatedObjects = objects.map(obj => {
                if (!selectedIds.includes(obj.id)) return obj;

                // 场景C：如果是子对象且其父组也被选中，跳过（父组会带动它）
                if (obj.parentId && selectedIds.includes(obj.parentId)) {
                    return obj;
                }

                // 场景B/G：如果是子对象但父组未被选中，更新relativePosition
                if (obj.parentId && !selectedIds.includes(obj.parentId)) {
                    return {
                        ...obj,
                        relativePosition: [
                            (obj.relativePosition?.[0] || 0) + finalOffset[0],
                            (obj.relativePosition?.[1] || 0) + finalOffset[1],
                            (obj.relativePosition?.[2] || 0) + finalOffset[2]
                        ]
                    };
                }

                // 场景A/F：更新独立对象或组对象的position
                return {
                    ...obj,
                    position: [
                        obj.position[0] + finalOffset[0],
                        obj.position[1] + finalOffset[1],
                        obj.position[2] + finalOffset[2]
                    ]
                };
            });
            
            // 立即更新objects，然后清除拖动状态
            setObjects(updatedObjects);
            
            // 在下一帧添加到历史记录，避免阻塞
            requestAnimationFrame(() => {
                const { history: currentHistory, index: currentIndex } = historyRef.current;
                const newHistory = currentHistory.slice(0, currentIndex + 1);
                newHistory.push(updatedObjects);
                if (newHistory.length > 50) newHistory.shift();
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            });
        }
        
        // 最后清除拖动状态
        dragOffsetRef.current = null;
        dragOffsetRef.lastUpdateTime = null;
        setDragOffset(null);
        setIsDragging(false);
    };
    const toggleEditMode = (id) => {
        const obj = objects.find(o => o.id === id);
        if (obj && (obj.type === 'curved_wall' || obj.type === 'polygon_floor')) {
            // 确保在编辑模式下工具模式为选择
            setToolMode('select');
            setIsEditingPoints(!isEditingPoints);
        }
    };

    // 计算用于显示的临时对象列表（包含拖动偏移和楼层过滤）
    const displayObjects = useMemo(() => {
        // 1. 楼层过滤 - 只显示当前楼层的对象
        const filteredObjects = objects.filter(obj => {
            // 如果对象有 floorLevel 属性，只显示当前楼层的对象
            if (obj.floorLevel && currentFloorLevel) {
                return obj.floorLevel === currentFloorLevel.name;
            }
            // 如果对象没有楼层信息，默认显示（如基础地面、底图等）
            return true;
        });

        // 调试信息：显示楼层过滤结果（仅在非拖动时打印，避免性能问题）
        if (currentFloorLevel && !isDragging) {
            const totalObjects = objects.filter(o => o.floorLevel).length;
            const hiddenObjects = objects.filter(o => o.floorLevel && o.floorLevel !== currentFloorLevel.name).length;
            console.log(`🏢 当前楼层: ${currentFloorLevel.name}, 显示: ${filteredObjects.length}个对象, 隐藏: ${hiddenObjects}个对象 (总共: ${totalObjects}个)`);
        }

        // 2. 处理组合对象的相对位置
        const objectsWithGroupPosition = filteredObjects.map(obj => {
            if (obj.parentId && obj.relativePosition) {
                // 查找父组对象
                const parent = filteredObjects.find(o => o.id === obj.parentId);
                if (parent) {
                    return {
                        ...obj,
                        position: [
                            parent.position[0] + obj.relativePosition[0],
                            parent.position[1] + obj.relativePosition[1],
                            parent.position[2] + obj.relativePosition[2]
                        ]
                    };
                }
            }
            return obj;
        });

        // 3. 应用拖动偏移
        if (!isDragging || !dragOffset) return objectsWithGroupPosition;
        return objectsWithGroupPosition.map(obj => {
            if (!selectedIds.includes(obj.id)) return obj;

            // 如果是子对象且其父组也被选中，不应用偏移（因为已经通过父组位置计算）
            if (obj.parentId && selectedIds.includes(obj.parentId)) {
                return obj;
            }

            // 应用拖动偏移到独立对象或组对象
            return {
                ...obj,
                position: [
                    obj.position[0] + dragOffset[0],
                    obj.position[1] + dragOffset[1],
                    obj.position[2] + dragOffset[2]
                ]
            };
        });
    }, [objects, isDragging, dragOffset, selectedIds, currentFloorLevel]);

    return (
        <div className={`flex h-screen w-screen bg-[#080808] text-gray-300 overflow-hidden select-none ${toolMode.startsWith('draw') ? 'cursor-crosshair' : ''}`}>
            {editingAsset && (
                <AssetEditModal 
                    asset={editingAsset} 
                    onClose={() => setEditingAsset(null)} 
                    onSave={handleUpdateAsset}
                    onDelete={handleDeleteAsset}
                    onExport={handleExportAsset}
                    onReplace={handleReplaceAsset}
                />
            )}

            {/* Map Selector Modal */}
            {showMapSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={() => setShowMapSelector(false)}>
                    <div className="bg-[#161616] w-[600px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <div className="flex items-center gap-2">
                                <Map size={18} className="text-green-400" />
                                <span className="text-sm font-bold text-white">选择内置地图</span>
                            </div>
                            <button onClick={() => setShowMapSelector(false)} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-3">
                            {builtInMapTemplates.map(template => (
                                <div
                                    key={template.id}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMapTemplate === template.id
                                        ? 'border-green-500 bg-green-900/20'
                                        : 'border-[#333] bg-[#0f0f0f] hover:border-green-500/50'
                                        }`}
                                    onClick={() => setSelectedMapTemplate(template.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-sm font-bold text-white mb-1">{template.name}</h3>
                                            <p className="text-[11px] text-gray-400">{template.description}</p>
                                        </div>
                                        {selectedMapTemplate === template.id && (
                                            <Check size={18} className="text-green-400" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end">
                            <button
                                onClick={() => setShowMapSelector(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => selectedMapTemplate && loadBuiltInMap(selectedMapTemplate)}
                                disabled={!selectedMapTemplate}
                                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded hover:from-green-700 hover:to-emerald-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                加载地图
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SLAM Upload Modal */}
            {showSLAMUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-[#161616] w-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <span className="text-sm font-bold text-white">上传 SLAM 地图</span>
                            <button onClick={() => setShowSLAMUpload(false)} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[11px] text-gray-400 block mb-2">YAML 配置文件 (.yaml)</label>
                                <input
                                    ref={slamYamlInputRef}
                                    type="file"
                                    accept=".yaml,.yml"
                                    className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] text-gray-400 block mb-2">地图图片 (.png, .pgm)</label>
                                <input
                                    ref={slamImageInputRef}
                                    type="file"
                                    accept=".png,.pgm,.jpg,.jpeg"
                                    className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3">
                                <p className="text-[10px] text-blue-300">
                                    <strong>提示：</strong> YAML 文件应包含 resolution 和 origin 参数。上传后将自动替换现有底图。
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end">
                            <button
                                onClick={() => setShowSLAMUpload(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSLAMUpload}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold"
                            >
                                上传
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 场景管理对话框 */}
            {showFloorManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-[#161616] w-[600px] rounded-xl border border-[#333] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <h3 className="text-sm font-bold text-white">场景管理</h3>
                            <button onClick={() => setShowFloorManager(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="mb-4">
                                <button
                                    onClick={() => {
                                        // 打开新增场景对话框
                                        setEditingFloor({
                                            id: Date.now().toString(),
                                            name: `场景 ${floors.length}`,
                                            description: '',
                                            mapPath: currentMapPath || availableMaps[0]?.path,
                                            isNew: true
                                        });
                                    }}
                                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} />
                                    新增场景
                                </button>
                            </div>

                            <div className="space-y-3">
                                {floors.map((floor, index) => (
                                    <div key={floor.id} className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-white mb-1">
                                                    {floor.name}
                                                    {floor.isDefault && <span className="ml-2 text-[10px] text-gray-500">(默认)</span>}
                                                </h4>
                                                <p className="text-xs text-gray-400">{floor.description}</p>
                                                <p className="text-[10px] text-gray-600 mt-1">
                                                    对象: {floor.objects?.length || 0} |
                                                    地图: {floor.baseMapData ? '✓' : '✗'} |
                                                    模型: {floor.sceneModelData ? '✓' : '✗'}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setEditingFloor(floor)}
                                                    className="p-1.5 hover:bg-[#252525] rounded text-blue-400 hover:text-blue-300 transition-colors"
                                                    title="编辑"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (floors.length > 1 && confirm(`确定要删除 ${floor.name} 吗？`)) {
                                                            setFloors(floors.filter(f => f.id !== floor.id));
                                                            if (currentFloorId === floor.id) {
                                                                setCurrentFloorId(floors[0].id);
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-[#252525] rounded text-red-400 hover:text-red-300 transition-colors"
                                                    title="删除"
                                                    disabled={floors.length === 1}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end">
                            <button
                                onClick={() => setShowFloorManager(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 编辑/新增场景对话框 */}
            {editingFloor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
                    <div className="bg-[#161616] w-[500px] max-h-[90vh] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a] flex-shrink-0">
                            <h3 className="text-sm font-bold text-white">{editingFloor.isNew ? '新增场景' : '编辑场景'}</h3>
                            <button onClick={() => setEditingFloor(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            <div>
                                <label className="block text-xs text-gray-400 mb-2">* 场景名称</label>
                                <input
                                    type="text"
                                    value={editingFloor.name}
                                    onChange={(e) => setEditingFloor({ ...editingFloor, name: e.target.value })}
                                    className="w-full bg-[#1a1a1a] border border-blue-500 rounded-lg px-4 py-2 text-sm text-white outline-none"
                                    placeholder="1楼"
                                />
                            </div>

                            {/* 楼层管理区域 */}
                            {!editingFloor.isNew && currentScene && currentScene.floorLevels && (
                                <div className="border-t border-[#2a2a2a] pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs text-gray-400">楼层管理</label>
                                        <button
                                            onClick={() => {
                                                const newName = prompt('新楼层名称:', `${currentScene.floorLevels.length + 1}F`);
                                                if (newName) addFloorLevel(newName);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-all"
                                        >
                                            <Plus size={12} />
                                            <span>新增楼层</span>
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {currentScene.floorLevels.map((floor) => (
                                            <div
                                                key={floor.id}
                                                className="bg-[#1a1a1a] rounded-lg overflow-hidden"
                                            >
                                                {/* 楼层标题栏 */}
                                                <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#222] transition-colors">
                                                    <button
                                                        onClick={() => setEditingFloorLevelId(editingFloorLevelId === floor.id ? null : floor.id)}
                                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                                        title="展开/收起"
                                                    >
                                                        {editingFloorLevelId === floor.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                    <div className="flex-1 text-xs text-white">{floor.name}</div>
                                                    <button
                                                        onClick={() => {
                                                            const newName = prompt('重命名楼层:', floor.name);
                                                            if (newName && newName.trim()) {
                                                                renameFloorLevel(floor.id, newName.trim());
                                                            }
                                                        }}
                                                        className="p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-all"
                                                        title="重命名"
                                                    >
                                                        <Edit3 size={12} />
                                                    </button>
                                                    {currentScene.floorLevels.length > 1 && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`确定删除楼层 "${floor.name}" 吗？\n该楼层的所有对象也会被删除。`)) {
                                                                    deleteFloorLevel(floor.id);
                                                                }
                                                            }}
                                                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all"
                                                            title="删除楼层"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* 楼层地图设置（可展开） */}
                                                {editingFloorLevelId === floor.id && (
                                                    <div className="px-3 pb-3 space-y-3 border-t border-[#2a2a2a] pt-3">
                                                        
                                                        {/* 1. 上传地图 */}
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1.5 font-medium">
                                                                上传地图 <span className="text-gray-600 font-normal">(JSON格式)</span>
                                                            </label>
                                                            {floor.baseMapData ? (
                                                                <>
                                                                    <div className="flex gap-2 mb-2">
                                                                        <div className="flex-1 bg-[#0e0e0e] border border-green-500/50 rounded px-2 py-1.5 flex items-center gap-1.5">
                                                                            <Check size={12} className="text-green-400" />
                                                                            <span className="text-[10px] text-green-400">已加载</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                setCurrentFloorLevelId(floor.id);
                                                                                document.getElementById('floor-json-upload').click();
                                                                            }}
                                                                            className="px-2 py-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-all border border-blue-500/30"
                                                                            title="重新上传"
                                                                        >
                                                                            <RefreshCw size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm('确定清除此楼层的数据源吗？')) {
                                                                                    setFloors(prev => prev.map(scene => {
                                                                                        if (scene.id === currentFloorId) {
                                                                                            return {
                                                                                                ...scene,
                                                                                                floorLevels: scene.floorLevels.map(fl => 
                                                                                                    fl.id === floor.id 
                                                                                                        ? { ...fl, waypointsData: null, pathsData: null, objects: [], baseMapData: null }
                                                                                                        : fl
                                                                                                )
                                                                                            };
                                                                                        }
                                                                                        return scene;
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            className="px-2 py-1.5 text-[10px] text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all"
                                                                            title="清除"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                    {/* 🔑 显示SLAM底图开关 */}
                                                                    <label className="flex items-center gap-2 px-2 py-1.5 bg-[#0e0e0e] border border-[#2a2a2a] rounded cursor-pointer hover:border-blue-500/30 transition-all">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={floor.showBaseMap !== false}
                                                                            onChange={(e) => {
                                                                                const show = e.target.checked;
                                                                                // 更新楼层配置
                                                                                setFloors(prev => prev.map(scene => {
                                                                                    if (scene.id === currentFloorId) {
                                                                                        return {
                                                                                            ...scene,
                                                                                            floorLevels: scene.floorLevels.map(fl => 
                                                                                                fl.id === floor.id 
                                                                                                    ? { ...fl, showBaseMap: show }
                                                                                                    : fl
                                                                                            )
                                                                                        };
                                                                                    }
                                                                                    return scene;
                                                                                }));
                                                                                // 更新场景中的底图对象可见性
                                                                                setObjects(prev => prev.map(obj => 
                                                                                    obj.id === `map_${floor.id}` && obj.type === 'map_image'
                                                                                        ? { ...obj, visible: show }
                                                                                        : obj
                                                                                ));
                                                                            }}
                                                                            className="w-3.5 h-3.5 rounded border-gray-600 bg-[#1a1a1a] checked:bg-blue-500 checked:border-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                                        />
                                                                        <span className="text-[10px] text-gray-300">显示SLAM底图</span>
                                                                    </label>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setCurrentFloorLevelId(floor.id);
                                                                        document.getElementById('floor-json-upload').click();
                                                                    }}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] text-gray-400 hover:text-white hover:bg-[#222] rounded transition-all border border-dashed border-[#333]"
                                                                >
                                                                    <Upload size={12} />
                                                                    <span>上传JSON文件</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        
                                                        {/* 2. 后端服务器地址 */}
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1.5 font-medium">
                                                                后端服务器地址 <span className="text-gray-600 font-normal">(可选)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={floor.serverUrl || ''}
                                                                onChange={(e) => {
                                                                    setFloors(prev => prev.map(scene => {
                                                                        if (scene.id === currentFloorId) {
                                                                            return {
                                                                                ...scene,
                                                                                floorLevels: scene.floorLevels.map(fl => 
                                                                                    fl.id === floor.id 
                                                                                        ? { ...fl, serverUrl: e.target.value }
                                                                                        : fl
                                                                                )
                                                                            };
                                                                        }
                                                                        return scene;
                                                                    }));
                                                                }}
                                                                placeholder="例如: http://192.168.1.100:8080"
                                                                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-blue-500 placeholder-gray-600"
                                                            />
                                                            <p className="text-[9px] text-gray-600 mt-1">用于楼层数据源的映射关系</p>
                                                        </div>
                                                        
                                                        {/* 3. GLB底图模型（可选） */}
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1.5 font-medium">
                                                                3D底图模型 <span className="text-gray-600 font-normal">(GLB/GLTF，可选)</span>
                                                            </label>
                                                            {floor.sceneModelData ? (
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1 bg-[#0e0e0e] border border-purple-500/50 rounded px-2 py-1.5 flex items-center gap-1.5">
                                                                        <Check size={12} className="text-purple-400" />
                                                                        <span className="text-[10px] text-purple-400">已加载</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setCurrentFloorLevelId(floor.id);
                                                                            document.getElementById(`floor-glb-upload-${floor.id}`).click();
                                                                        }}
                                                                        className="px-2 py-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-all border border-blue-500/30"
                                                                        title="重新上传"
                                                                    >
                                                                        <RefreshCw size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm('确定清除此楼层的3D模型吗？')) {
                                                                                // 清除楼层数据中的模型
                                                                                setFloors(prev => prev.map(scene => {
                                                                                    if (scene.id === currentFloorId) {
                                                                                        return {
                                                                                            ...scene,
                                                                                            floorLevels: scene.floorLevels.map(fl => 
                                                                                                fl.id === floor.id 
                                                                                                    ? { ...fl, sceneModelData: null }
                                                                                                    : fl
                                                                                            )
                                                                                        };
                                                                                    }
                                                                                    return scene;
                                                                                }));
                                                                                
                                                                                // 🔑 同时从objects中移除模型对象
                                                                                if (floor.id === currentFloorLevelId) {
                                                                                    const modelId = `model_${floor.id}`;
                                                                                    setObjects(prev => prev.filter(obj => obj.id !== modelId));
                                                                                    console.log('🗑️ 已从场景中移除模型:', modelId);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="px-2 py-1.5 text-[10px] text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all"
                                                                        title="清除"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setCurrentFloorLevelId(floor.id);
                                                                        document.getElementById(`floor-glb-upload-${floor.id}`).click();
                                                                    }}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] text-gray-400 hover:text-white hover:bg-[#222] rounded transition-all border border-dashed border-[#333]"
                                                                >
                                                                    <Upload size={12} />
                                                                    <span>上传GLB模型</span>
                                                                </button>
                                                            )}
                                                            <input
                                                                id={`floor-glb-upload-${floor.id}`}
                                                                type="file"
                                                                className="hidden"
                                                                accept=".glb,.gltf"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files[0];
                                                                    if (!file) return;
                                                                    
                                                                    if (file.size > 50 * 1024 * 1024) {
                                                                        alert('文件过大！请选择小于 50MB 的模型文件。');
                                                                        e.target.value = '';
                                                                        return;
                                                                    }
                                                                    
                                                                    try {
                                                                        // 🔑 上传GLB模型到Supabase Storage
                                                                        console.log('📤 开始上传GLB模型到Supabase Storage...');
                                                                        
                                                                        // 生成安全的文件名（移除中文和特殊字符）
                                                                        const timestamp = Date.now();
                                                                        const fileExt = file.name.split('.').pop();
                                                                        const safeFileName = `glb-models/${timestamp}.${fileExt}`;
                                                                        
                                                                        console.log('📝 原始文件名:', file.name);
                                                                        console.log('📝 安全文件名:', safeFileName);
                                                                        
                                                                        const { data: uploadData, error: uploadError } = await supabase.storage
                                                                            .from('digital-twin-assets')
                                                                            .upload(safeFileName, file, {
                                                                                cacheControl: '3600',
                                                                                upsert: false
                                                                            });
                                                                        
                                                                        if (uploadError) {
                                                                            console.error('❌ 上传GLB模型失败:', uploadError);
                                                                            alert('上传模型失败: ' + uploadError.message);
                                                                            return;
                                                                        }
                                                                        
                                                                        // 获取公开URL
                                                                        const { data: urlData } = supabase.storage
                                                                            .from('digital-twin-assets')
                                                                            .getPublicUrl(safeFileName);
                                                                        
                                                                        const url = urlData.publicUrl;
                                                                        console.log('✅ GLB模型上传成功:', url);
                                                                            
                                                                            // 自动计算模型的缩放和位置
                                                                            let autoScale = [1, 1, 1];
                                                                            let autoPosition = [0, 0, 0];
                                                                            
                                                                            // 获取当前楼层的底图数据
                                                                            const mapData = floor.baseMapData;
                                                                            
                                                                            if (mapData) {
                                                                                console.log('根据底图数据自动计算模型变换:', mapData);
                                                                                
                                                                                // 计算底图的实际尺寸（米）
                                                                                const mapWidth = mapData.actualSize.width * mapData.resolution;
                                                                                const mapHeight = mapData.actualSize.height * mapData.resolution;
                                                                                
                                                                                console.log('  - 底图尺寸:', mapWidth, 'x', mapHeight, '米');
                                                                                
                                                                                // 🔑 先使用临时缩放，模型加载后会自动计算真实缩放
                                                                                // 标记需要自动适配
                                                                                autoScale = [1, 1, 1]; // 临时值，会在模型加载后更新
                                                                                
                                                                                console.log('📐 将在模型加载后自动计算缩放以适配底图');
                                                                                
                                                                                // 🔑 底图居中在(0,0,0)，所以模型初始位置也是(0,0,0)
                                                                                // 实际位置会在AutoScaleGltf组件中计算
                                                                                autoPosition = [0, 0.01, 0];
                                                                                
                                                                                console.log('  - 底图原点:', [mapData.origin.x, mapData.origin.y]);
                                                                                console.log('  - 底图居中在世界原点 (0, 0, 0)');
                                                                                console.log('  - 自动缩放:', autoScale);
                                                                                console.log('  - 自动位置:', autoPosition);
                                                                            } else {
                                                                                console.log('⚠️ 楼层没有底图数据，使用默认变换');
                                                                            }
                                                                            
                                                                            // 保存模型数据到楼层
                                                                            setFloors(prev => prev.map(scene => {
                                                                                if (scene.id === currentFloorId) {
                                                                                    return {
                                                                                        ...scene,
                                                                                        floorLevels: scene.floorLevels.map(fl => 
                                                                                            fl.id === floor.id 
                                                                                                ? { 
                                                                                                    ...fl, 
                                                                                                    sceneModelData: {
                                                                                                        fileName: file.name,
                                                                                                        url: url,
                                                                                                        scale: autoScale,
                                                                                                        position: autoPosition
                                                                                                    }
                                                                                                }
                                                                                                : fl
                                                                                        )
                                                                                    };
                                                                                }
                                                                                return scene;
                                                                            }));
                                                                            
                                                                            // 💾 保存到Supabase（异步，不阻塞UI）
                                                                            saveGLBModel(floor.id, {
                                                                                fileName: file.name,
                                                                                url: url,
                                                                                scale: autoScale,
                                                                                position: autoPosition
                                                                            }).then(() => {
                                                                                console.log('✅ GLB模型已保存到Supabase');
                                                                            }).catch(error => {
                                                                                console.error('❌ 保存GLB模型到Supabase失败:', error);
                                                                                console.error('错误详情:', JSON.stringify(error, null, 2));
                                                                            });
                                                                            
                                                                            // 🔑 立即创建模型对象并添加到场景
                                                                            console.log('🔍 检查是否添加到当前场景:', {
                                                                                floorId: floor.id,
                                                                                currentFloorLevelId: currentFloorLevelId,
                                                                                match: floor.id === currentFloorLevelId
                                                                            });
                                                                            
                                                                            if (floor.id === currentFloorLevelId) {
                                                                                console.log('💡 立即添加模型到当前场景');
                                                                                const modelObj = {
                                                                                    id: `model_${floor.id}`,
                                                                                    type: 'custom_model',
                                                                                    name: file.name || '3D底图模型',
                                                                                    locked: true, // 🔒 锁定，不允许修改
                                                                                    modelUrl: url,
                                                                                    modelScale: 1,
                                                                                    position: autoPosition,
                                                                                    scale: autoScale,
                                                                                    rotation: [0, 0, 0],
                                                                                    visible: true,
                                                                                    opacity: 1,
                                                                                    color: '#ffffff'
                                                                                };
                                                                                
                                                                                console.log('🏗️ 创建的模型对象:', modelObj);
                                                                                
                                                                                // 移除旧的模型对象（如果有）
                                                                                setObjects(prev => {
                                                                                    const filtered = prev.filter(obj => obj.id !== modelObj.id);
                                                                                    return [...filtered, modelObj];
                                                                                });
                                                                            }
                                                                            
                                                                            alert('✅ 3D模型已上传并显示\n\n缩放: 1:1 (原始尺寸)\n位置: 底图中心');
                                                                    } catch (error) {
                                                                        console.error('模型加载失败:', error);
                                                                        alert('模型加载失败: ' + error.message);
                                                                    } finally {
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        
                                                        {/* 统计信息 */}
                                                        <div className="pt-2 border-t border-[#2a2a2a] text-[10px] text-gray-500 space-y-0.5">
                                                            <div>对象数量: {floor.objects?.length || 0}</div>
                                                            {floor.waypointsData && <div className="text-green-400">✓ 点位: {floor.waypointsData.length}</div>}
                                                            {floor.pathsData && <div className="text-green-400">✓ 路径: {floor.pathsData.length}</div>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end flex-shrink-0 bg-[#161616]">
                            <button
                                onClick={() => setEditingFloor(null)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={async () => {
                                    // ===============================================
                                    // 🔒 强制互斥结构：要么是新增，要么是编辑
                                    // ===============================================

                                    if (editingFloor.isNew) {
                                        // -------------------------------------------
                                        // 分支 A: 新增场景 (New Scene)
                                        // 🔑 新逻辑：只创建空场景，不加载任何数据
                                        // -------------------------------------------
                                        const sceneName = editingFloor.name; // 获取用户输入的场景名

                                        console.log('🚀 [新增场景] 创建空场景:', sceneName);

                                        // 创建新场景，只包含一个空的1F楼层
                                        const newFloor = {
                                            id: uuidv4(),
                                            name: sceneName,
                                            description: '空场景',
                                            isDefault: false,
                                            // 🏢 楼层列表：创建默认的1F楼层（空的）
                                            floorLevels: [{
                                                id: `floor-${Date.now()}`, // 使用唯一ID
                                                name: '1F',
                                                height: 0,
                                                visible: true,
                                                objects: [], // 空数组，不包含任何对象
                                                baseMapData: null,
                                                baseMapId: null,
                                                waypointsData: null,
                                                pathsData: null,
                                                sceneModelData: null
                                            }]
                                        };

                                        // 添加到场景列表
                                        const hasOnlyDefaultScene = floors.length === 1 && floors[0].isDefault;
                                        if (hasOnlyDefaultScene) {
                                            // 替换默认场景
                                            setFloors([newFloor]);
                                        } else {
                                            // 添加到现有场景列表
                                            setFloors([...floors, newFloor]);
                                        }

                                        // 切换到新场景
                                        setCurrentFloorId(newFloor.id);
                                        setEditingFloor(null);
                                        setShowFloorManager(false);

                                        alert(`✅ 场景创建成功\n\n场景名称: ${sceneName}\n已创建默认楼层: 1F\n\n请在"编辑场景"中为楼层添加地图数据。`);
                                        return;
                                    }

                                    // -------------------------------------------
                                    // 分支 B: 编辑现有场景
                                    // -------------------------------------------
                                    console.log('📝 编辑场景，只更新场景名称');

                                    // 更新场景名称
                                    const newFloors = floors.map(f => {
                                        if (f.id === editingFloor.id) {
                                            return {
                                                ...f,
                                                name: editingFloor.name
                                            };
                                        }
                                        return f;
                                    });
                                    setFloors(newFloors);
                                    
                                    setEditingFloor(null);
                                    setShowFloorManager(false);
                                    
                                    alert('✅ 场景名称已更新');
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold"
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 楼层JSON数据上传 */}
            <input
                id="floor-json-upload"
                type="file"
                className="hidden"
                accept=".json"
                onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        const text = await file.text();
                        const jsonData = JSON.parse(text);
                        
                        console.log('📤 上传JSON到楼层:', currentFloorLevel?.name);
                        
                        // 调用loadMapFromJSON，它会自动保存到当前楼层
                        loadMapFromJSON(jsonData);
                        
                        alert('✅ 数据源加载成功！');
                    } catch (error) {
                        console.error('JSON解析失败:', error);
                        alert('JSON文件解析失败: ' + error.message);
                    } finally {
                        e.target.value = '';
                    }
                }}
            />

            {/* 默认场景覆盖确认对话框 */}
            {showOverwriteConfirmDialog && pendingNewSceneData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-[#161616] w-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <h3 className="text-sm font-bold text-white">新建场景确认</h3>
                            <button onClick={() => setShowOverwriteConfirmDialog(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* 内容区域 */}
                        <div className="p-6 space-y-4">
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-3">
                                <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
                                <div>
                                    <p className="text-sm font-bold text-yellow-200 mb-1">当前默认场景已有内容</p>
                                    <p className="text-xs text-gray-400">您正在创建一个新场景，但默认场景中已经存在编辑过的内容（墙体、柱子等装饰物）。</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-[#333] bg-[#1a1a1a] hover:border-gray-600 cursor-pointer transition-colors">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${overwriteDefaultScene ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                                        {overwriteDefaultScene && <Check size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={overwriteDefaultScene}
                                        onChange={(e) => setOverwriteDefaultScene(e.target.checked)}
                                        className="hidden"
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-200">替换默认场景（丢弃装饰物）</span>
                                        <p className="text-xs text-gray-500 mt-0.5">选中：丢弃默认场景的所有内容，只保留新场景<br />不选中：新场景将继承默认场景的装饰物（推荐）</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="p-4 border-t border-[#2a2a2a] flex gap-3 justify-end bg-[#1a1a1a]">
                            <button
                                onClick={() => setShowOverwriteConfirmDialog(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    const { newFloor, finalObjects, newEntities, newPaths, baseMap, sceneModelObj } = pendingNewSceneData;

                                    if (overwriteDefaultScene) {
                                        // 替换逻辑：直接用新场景替换默认场景
                                        console.log('🔄 替换模式：用新场景替换默认场景');
                                        setFloors([newFloor]);

                                        // 切换到新场景
                                        setCurrentFloorId(newFloor.id);
                                        setObjects(finalObjects);
                                        setHistory([finalObjects]);
                                        setHistoryIndex(0);
                                    } else {
                                        // 合并逻辑：新场景继承默认场景的装饰物，然后删除默认场景
                                        console.log('📝 合并模式：新场景将继承默认场景的装饰物');

                                        // 1. 从当前对象中提取装饰物（非路网、非底图的元素）
                                        const decorativeObjects = objects.filter(obj =>
                                            !obj.isBaseMap && // 不是底图
                                            obj.type !== 'waypoint' && // 不是路网点位
                                            obj.type !== 'path_line' && // 不是路径
                                            !obj.sourceRefId // 不是绑定到路网的对象
                                        );

                                        console.log('🎨 提取的装饰物:', decorativeObjects.length, '个');
                                        console.log('📋 装饰物列表:', decorativeObjects.map(o => ({ type: o.type, name: o.name })));

                                        // 2. 合并：新场景的对象 + 继承的装饰物
                                        const mergedObjects = [...finalObjects, ...decorativeObjects];

                                        // 3. 更新新场景的对象列表
                                        const newFloorWithDecorations = {
                                            ...newFloor,
                                            objects: mergedObjects
                                        };

                                        // 4. 删除默认场景，只保留新场景
                                        console.log('🗑️ 删除默认场景，只保留新场景');
                                        const nonDefaultFloors = floors.filter(f => !f.isDefault);
                                        setFloors([...nonDefaultFloors, newFloorWithDecorations]);

                                        // 5. 切换到新场景
                                        setCurrentFloorId(newFloorWithDecorations.id);
                                        setObjects(mergedObjects);
                                        setHistory([mergedObjects]);
                                        setHistoryIndex(0);
                                    }

                                    // 关闭弹窗
                                    setShowOverwriteConfirmDialog(false);
                                    setEditingFloor(null);
                                    setShowFloorManager(false);

                                    alert(`✅ 场景创建成功\n\n地图: ${baseMap.name}\n点位: ${newEntities.length} 个\n路径: ${newPaths.length} 条${sceneModelObj ? '\n3D模型: 已自动对齐' : ''}`);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold"
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 退出确认对话框 */}
            {showExitConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-[#161616] w-[450px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <h3 className="text-sm font-bold text-white">退出确认</h3>
                            <button onClick={() => setShowExitConfirmDialog(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* 内容区域 */}
                        <div className="p-6 space-y-4">
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-3">
                                <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
                                <div>
                                    <p className="text-sm font-bold text-yellow-200 mb-1">有未保存的更改</p>
                                    <p className="text-xs text-gray-400">当前场景有未保存的更改，退出后这些更改将会丢失。</p>
                                </div>
                            </div>

                            <div className="text-xs text-gray-400">
                                <p>您可以选择：</p>
                                <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                                    <li>点击"保存并退出"保存更改后关闭</li>
                                    <li>点击"放弃更改"直接退出，不保存</li>
                                    <li>点击"取消"返回继续编辑</li>
                                </ul>
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="p-4 border-t border-[#2a2a2a] flex gap-3 justify-end bg-[#1a1a1a]">
                            <button
                                onClick={() => setShowExitConfirmDialog(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={forceExit}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold"
                            >
                                放弃更改
                            </button>
                            <button
                                onClick={saveAndExit}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold flex items-center gap-2"
                            >
                                <Save size={14} />
                                保存并退出
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 合并策略对话框 */}
            {showMergeDialog && mergeDialogData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-[#161616] w-[600px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <h3 className="text-sm font-bold text-white">更新路网数据</h3>
                            <button onClick={() => setShowMergeDialog(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* 内容区域 */}
                        <div className="p-6 space-y-4">
                            {/* 警告信息 */}
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <p className="text-sm text-yellow-200 mb-2">⚠️ 检测到正在更新现有场景的路网数据</p>
                                <p className="text-xs text-gray-400">
                                    新地图包含 <span className="text-white font-bold">{mergeDialogData.newEntities.length}</span> 个点位，
                                    <span className="text-white font-bold">{mergeDialogData.newPaths.length}</span> 条路径
                                </p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm text-gray-300">请选择更新策略：</p>

                                {/* 选项 1: 保留绑定（推荐） */}
                                <div
                                    onClick={() => setMergeStrategy('merge')}
                                    className={`w-full p-4 border rounded-lg text-left transition-all cursor-pointer relative ${mergeStrategy === 'merge'
                                        ? 'bg-blue-500/10 border-blue-500/50'
                                        : 'bg-[#1a1a1a] border-[#333] hover:border-gray-600'
                                        }`}
                                >
                                    {/* 单选框 */}
                                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${mergeStrategy === 'merge' ? 'border-blue-500' : 'border-gray-600'
                                        }`}>
                                        {mergeStrategy === 'merge' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                    </div>

                                    <div className="pr-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-sm font-bold text-white">保留孪生绑定</h4>
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">推荐</span>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            • 保留已配置的 3D 模型、颜色、交互逻辑<br />
                                            • 仅更新点位坐标和角度<br />
                                            • 自动处理新增/删除的点位<br />
                                            • 保留所有装饰物和虚拟对象
                                        </p>
                                    </div>
                                </div>

                                {/* 选项 2: 完全覆盖 */}
                                <div
                                    onClick={() => setMergeStrategy('overwrite')}
                                    className={`w-full p-4 border rounded-lg text-left transition-all cursor-pointer relative ${mergeStrategy === 'overwrite'
                                        ? 'bg-blue-500/10 border-blue-500/50'
                                        : 'bg-[#1a1a1a] border-[#333] hover:border-gray-600'
                                        }`}
                                >
                                    {/* 单选框 */}
                                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${mergeStrategy === 'overwrite' ? 'border-blue-500' : 'border-gray-600'
                                        }`}>
                                        {mergeStrategy === 'overwrite' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                    </div>

                                    <div className="pr-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-sm font-bold text-white">完全覆盖</h4>
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">危险</span>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            • 删除所有现有实体<br />
                                            • 丢失已配置的模型和样式<br />
                                            • 使用新路网重新生成默认模型<br />
                                            • <span className="text-yellow-400">⚠️ 此操作不可撤销</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="p-4 border-t border-[#2a2a2a] flex gap-3 justify-end bg-[#1a1a1a]">
                            <button
                                onClick={() => setShowMergeDialog(false)}
                                className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                            >
                                取消
                            </button>

                            <button
                                onClick={() => {
                                    if (mergeStrategy === 'merge') {
                                        // ========================================
                                        // 策略 A: 保留绑定
                                        // ========================================
                                        console.log('✅ 执行策略 A：保留绑定');

                                        // 智能合并
                                        const mergedEntities = smartMergeEntities(mergeDialogData.newEntities, objects);

                                        // 冲突检测
                                        const conflicts = checkSpatialConflicts(mergedEntities, objects);
                                        if (conflicts.length > 0) {
                                            console.warn(`⚠️ 发现 ${conflicts.length} 处空间冲突`);
                                            setConflictData(conflicts);
                                            setShowConflictDialog(true);
                                        }

                                        // 保留装饰物
                                        const decorators = objects.filter(o => !o.sourceRefId && !o.isBaseMap && o.type !== 'floor');

                                        // 组合最终对象
                                        const finalObjects = [
                                            initialObjects[0],
                                            mergeDialogData.baseMap,
                                            ...mergedEntities,
                                            ...mergeDialogData.newPaths,
                                            ...decorators
                                        ].filter(Boolean);

                                        setObjects(finalObjects);
                                        setHistory([finalObjects]);
                                        setHistoryIndex(0);

                                        setShowMergeDialog(false);
                                        alert(`✅ 路网更新成功（保留绑定）\n\n更新点位: ${mergedEntities.length} 个\n更新路径: ${mergeDialogData.newPaths.length} 条${conflicts.length > 0 ? `\n\n⚠️ 发现 ${conflicts.length} 处冲突，请检查` : ''}`);

                                    } else {
                                        // ========================================
                                        // 策略 B: 完全覆盖
                                        // ========================================
                                        const confirmed = window.confirm(
                                            '⚠️ 危险操作确认\n\n' +
                                            '选择"完全覆盖"将删除所有现有实体，包括：\n' +
                                            '• 已配置的 3D 模型\n' +
                                            '• 自定义颜色和样式\n' +
                                            '• 所有装饰物和虚拟对象\n\n' +
                                            '确定要继续吗？'
                                        );

                                        if (!confirmed) return;

                                        console.log('⚠️ 执行策略 B：完全覆盖');

                                        // 简单暴力：全删全换
                                        const finalObjects = [
                                            initialObjects[0],
                                            mergeDialogData.baseMap,
                                            ...mergeDialogData.newEntities,
                                            ...mergeDialogData.newPaths
                                        ].filter(Boolean);

                                        setObjects(finalObjects);
                                        setHistory([finalObjects]);
                                        setHistoryIndex(0);

                                        setShowMergeDialog(false);
                                        alert(`✅ 路网已完全覆盖\n\n新点位: ${mergeDialogData.newEntities.length} 个\n新路径: ${mergeDialogData.newPaths.length} 条`);
                                    }
                                }}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
                            >
                                确定更新
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 冲突检测对话框 */}
            {showConflictDialog && conflictData && (
                <div className="fixed top-4 right-4 z-50 w-96 bg-[#161616] rounded-xl border border-yellow-500/50 shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-yellow-500/10">
                        <h3 className="text-sm font-bold text-yellow-200 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>空间冲突报告</span>
                        </h3>
                        <button onClick={() => setShowConflictDialog(false)} className="text-gray-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-4 max-h-96 overflow-y-auto">
                        <p className="text-xs text-gray-400 mb-3">
                            发现 <span className="text-yellow-400 font-bold">{conflictData.length}</span> 处点位重叠，请手动调整
                        </p>

                        <div className="space-y-2">
                            {conflictData.map((conflict, index) => (
                                <div key={index} className="bg-[#1a1a1a] rounded-lg p-3 border border-yellow-500/20">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-xs font-bold text-yellow-400">冲突 #{index + 1}</span>
                                        <span className="text-xs text-gray-500">距离: {conflict.distance}m</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <div className="text-blue-400">
                                            📍 新点位: {conflict.newItem.name}
                                        </div>
                                        <div className="text-red-400">
                                            🔴 现有对象: {conflict.existingItem.name}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t border-[#2a2a2a]">
                        <button
                            onClick={() => setShowConflictDialog(false)}
                            className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-bold"
                        >
                            我知道了
                        </button>
                    </div>
                </div>
            )}

            {/* UI Layer: Hide when in Preview Mode */}
            {!isPreviewMode && (
                <>
                    {/* Left Panel */}
                    <div className="w-64 flex flex-col border-r border-[#1a1a1a] bg-[#0f0f0f]">
                        <div className="h-14 flex items-center px-4 gap-3 border-b border-[#1a1a1a]">
                            <img 
                                src={import.meta.env.BASE_URL + 'logo.png'}
                                alt="Logo" 
                                className="w-8 h-8 object-contain rounded p-1"
                                onError={(e) => {
                                    // 如果图片加载失败，显示文字Logo
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                }}
                            />
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg items-center justify-center text-white font-bold text-sm shadow-lg hidden">
                                DT
                            </div>
                            <span className="text-xs font-bold tracking-wide text-white">Digital Twin Pro 2.0</span>
                        </div>
                        {/* ... Search & Tabs ... */}
                        <div className="px-3 pt-3 pb-2">
                            <div className="flex bg-[#1a1a1a] p-1 rounded-md mb-2">
                                <button onClick={() => setSidebarTab('assets')} className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${sidebarTab === 'assets' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>资源库</button>
                                <button onClick={() => setSidebarTab('layers')} className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${sidebarTab === 'layers' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>图层</button>
                            </div>
                            <div className="bg-[#1a1a1a] flex items-center px-2 py-1.5 rounded-md border border-[#2a2a2a] focus-within:border-blue-500/50 transition-colors"><Search size={12} className="text-gray-500 mr-2" /><input type="text" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-[11px] w-full text-gray-300 placeholder-gray-600" /></div>
                        </div>
                        {/* ... Assets List ... */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pt-0">
                            {sidebarTab === 'assets' && (
                                <div className="space-y-4 pt-2">
                                    <div><div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">创建工具</div><div className="grid grid-cols-3 gap-2"><button onClick={() => setToolMode('draw_wall')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_wall' ? 'border-blue-500 text-blue-400' : 'text-gray-400'}`}><PenTool size={18} /> <span className="text-[10px]">直墙</span></button><button onClick={() => setToolMode('draw_curve')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_curve' ? 'border-purple-500 text-purple-400' : 'text-gray-400'}`}><Spline size={18} /> <span className="text-[10px]">连续曲线</span></button><button onClick={() => setToolMode('draw_floor')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_floor' ? 'border-orange-500 text-orange-400' : 'text-gray-400'}`}><LandPlot size={18} /> <span className="text-[10px]">多边形</span></button></div></div>
                                    {/* SLAM 地图 - 已隐藏 */}
                                    {false && (
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">SLAM 地图</div>
                                            <button onClick={() => setShowMapSelector(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-md bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all text-white border border-green-500/50 mb-2">
                                                <Map size={16} />
                                                <span className="text-[11px] font-bold">选择内置地图</span>
                                            </button>
                                            <button onClick={() => setShowSLAMUpload(true)} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all text-white border border-blue-500/50">
                                                <Upload size={16} />
                                                <span className="text-[11px] font-bold">上传 SLAM 地图</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* JSON Import Button - Hidden */}
                                    {false && <div className="mt-2"><button onClick={() => jsonImportRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-[#222] hover:bg-[#333] transition-all text-gray-300 border border-[#333]"><FileJson size={16} /> <span className="text-[11px]">导入工程 JSON</span></button><input type="file" ref={jsonImportRef} className="hidden" accept=".json" onChange={handleJSONImport} /></div>}
                                    <div className="border border-dashed border-[#333] rounded-md p-3 text-center hover:border-blue-500/50 transition-colors cursor-pointer group" onClick={() => assetUploadRef.current?.click()}><input type="file" ref={assetUploadRef} className="hidden" accept=".glb,.gltf" onChange={handleAddAsset} /><PlusSquare size={20} className="mx-auto text-gray-500 group-hover:text-blue-400 mb-1" /><span className="text-[10px] text-gray-500 group-hover:text-blue-300">导入新资产 (.glb)</span></div>
                                    <div><div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">基础组件</div><div className="space-y-1">{filteredAssets.filter(a => a.category !== '自定义').map((asset, idx) => (<SidebarItem key={idx} asset={asset} onDragStart={(e) => { e.dataTransfer.setData('type', asset.type); e.dataTransfer.effectAllowed = 'copy'; }} />))}</div></div>
                                    {customAssets.length > 0 && (<div><div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1 mt-2">自定义资产</div><div className="space-y-1">{filteredAssets.filter(a => a.category === '自定义').map((asset, idx) => (<SidebarItem key={`custom-${idx}`} asset={asset} onEdit={setEditingAsset} onDragStart={(e) => { e.dataTransfer.setData('type', 'custom_model'); e.dataTransfer.setData('assetId', asset.id); e.dataTransfer.effectAllowed = 'copy'; }} />))}</div></div>)}
                                </div>
                            )}

                            {sidebarTab === 'layers' && (
                                <div className="pt-2">
                                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1 flex justify-between">
                                        <span>场景对象</span>
                                        <span className="bg-[#222] px-1.5 rounded text-[9px]">
                                            {filteredObjects.filter(o => o.type !== 'group').length}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {(() => {
                                            const topLevelObjects = [...filteredObjects].reverse().filter(obj => !obj.parentId);
                                            console.log('📋 顶层对象列表:', topLevelObjects.map(o => ({ 
                                                name: o.name, 
                                                type: o.type, 
                                                parentId: o.parentId 
                                            })));
                                            return topLevelObjects.map(obj => (
                                            <LayerItem
                                                key={obj.id}
                                                obj={obj}
                                                allObjects={filteredObjects}
                                                selectedIds={selectedIds}
                                                editingNameId={editingNameId}
                                                editingName={editingName}
                                                setEditingName={setEditingName}
                                                setToolMode={setToolMode}
                                                setSelectedId={setSelectedId}
                                                setSelectedIds={setSelectedIds}
                                                startEditingName={startEditingName}
                                                saveEditingName={saveEditingName}
                                                cancelEditingName={cancelEditingName}
                                                updateObject={updateObject}
                                            />
                                        ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 场景切换 UI */}
                        <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">场景</span>
                                <button
                                    onClick={() => setShowFloorManager(true)}
                                    className="p-1 hover:bg-[#1a1a1a] rounded text-gray-500 hover:text-white transition-colors"
                                    title="场景管理"
                                >
                                    <Settings size={12} />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {floors
                                    .filter(floor => {
                                        // 如果有多个场景，隐藏默认场景（用户已经创建了实际场景）
                                        if (floors.length > 1 && floor.isDefault) {
                                            return false;
                                        }
                                        return true;
                                    })
                                    .map(floor => (
                                        <button
                                            key={floor.id}
                                            onClick={() => {
                                                // 如果是默认场景，打开创建场景弹窗
                                                if (floor.isDefault) {
                                                    setEditingFloor({
                                                        id: Date.now().toString(),
                                                        name: '场景 1',
                                                        description: '',
                                                        mapPath: availableMaps[0]?.path,
                                                        isNew: true
                                                    });
                                                } else {
                                                    setCurrentFloorId(floor.id);
                                                }
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${currentFloorId === floor.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white'
                                                }`}
                                        >
                                            <Layers size={14} />
                                            <span className="flex-1 text-left">{floor.name}</span>
                                            {floor.isDefault && <Plus size={12} className="text-gray-500" />}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Middle: Canvas */}
            <div className="flex-1 relative bg-[#09090b]">
                {/* ... Toolbars ... */}
                {!isPreviewMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-xl p-1 flex gap-1 shadow-2xl bg-[#09090b]">
                        <ToolBtn icon={MousePointer2} active={toolMode === 'select' && !transformMode && !isEditingPoints} onClick={() => { setToolMode('select'); setTransformMode(null); }} title="选择 (Shift+拖动框选)" />
                        <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
                        {/* 绘制路径按钮 - 暂时隐藏 */}
                        {false && <ToolBtn icon={Spline} active={toolMode === 'draw_path'} onClick={() => { setToolMode('draw_path'); setTransformMode(null); }} title="绘制路径 (点击创建点/连接点)" />}
                        {false && <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>}
                        <ToolBtn icon={Move} active={toolMode === 'select' && transformMode === 'translate'} onClick={() => { setToolMode('select'); setTransformMode('translate'); setIsBoxSelecting(false); }} title="移动" />
                        <ToolBtn icon={RotateCw} active={toolMode === 'select' && transformMode === 'rotate'} onClick={() => { setToolMode('select'); setTransformMode('rotate'); }} title="旋转" />
                        <ToolBtn icon={Maximize} active={toolMode === 'select' && transformMode === 'scale'} onClick={() => { setToolMode('select'); setTransformMode('scale'); }} title="缩放" />
                        <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
                        <ToolBtn icon={ArrowDownToLine} onClick={snapObjectToGround} title="贴齐地面" />
                        <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
                        <button
                            onClick={() => setEnableSnap(!enableSnap)}
                            className={`p-2.5 rounded-lg transition-all duration-200 ${enableSnap
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                : 'text-gray-500 hover:bg-[#333] hover:text-gray-200'
                                }`}
                            title={`网格吸附: ${enableSnap ? '开' : '关'} (Alt键临时切换)`}
                        >
                            <Magnet size={18} strokeWidth={enableSnap ? 2.5 : 2} />
                        </button>
                    </div>
                )}

                {!isPreviewMode && toolMode !== 'select' && (<div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-full text-xs shadow-lg backdrop-blur z-20 animate-bounce pointer-events-none">{toolMode === 'draw_wall' && "点击绘制直墙 (右键/Enter 结束)"}{toolMode === 'draw_curve' && "点击添加曲线点 (右键/Enter 结束)"}{toolMode === 'draw_floor' && "点击绘制地面顶点 (右键/Enter 结束)"}</div>)}

                {/* 楼层切换器 - 左下角浮动 */}
                {!isPreviewMode && currentScene && currentScene.floorLevels && currentScene.floorLevels.length > 0 && (
                    <div className="absolute bottom-6 left-6 z-20">
                        <div className="glass-panel rounded-lg p-1.5 flex flex-col gap-1 shadow-xl bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/5">
                            {currentScene.floorLevels.map((floor) => (
                                <button
                                    key={floor.id}
                                    onClick={() => setCurrentFloorLevelId(floor.id)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 min-w-[60px] ${currentFloorLevelId === floor.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                            : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                                        }`}
                                    title={`切换到 ${floor.name}`}
                                >
                                    {floor.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 多选提示 */}
                {!isPreviewMode && selectedIds.length > 1 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-lg text-xs shadow-lg backdrop-blur z-20 flex items-center gap-2">
                        <CopyCheck size={16} />
                        <span>已选中 {selectedIds.length} 个对象 - 可一起移动</span>
                    </div>
                )}

                {/* Top Right Controls: Preview and Save Button */}
                <div className="absolute top-4 right-6 z-20 flex gap-2">
                    {/* 预览按钮 */}
                    <a
                        href="https://www.figma.com/proto/evYdd25AKezIYSp8T5A1x8/Untitled?page-id=0%3A1&node-id=1-996&viewport=317%2C241%2C0.24&scaling=contain&content-scaling=fixed"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass-panel p-1.5 bg-[#080808] rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-blue-600 flex items-center justify-center"
                        title="打开预览页面"
                    >
                        <Play size={18} />
                    </a>
                    {/* 保存按钮 */}
                    {!isPreviewMode && (
                        <button
                            onClick={saveCurrentScene}
                            className="glass-panel px-3 py-1.5 bg-[#080808] rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-[#333] flex items-center justify-center gap-2"
                            title="保存当前场景 (Ctrl+S)"
                        >
                            <Save size={18} />
                            <span className="text-sm">保存</span>
                        </button>
                    )}
                    {/* 清除本地数据按钮 */}
                    {!isPreviewMode && (
                        <button
                            onClick={() => {
                                if (window.confirm('确定要清除所有本地保存的数据吗？\n\n此操作将删除所有场景和对象，无法恢复！')) {
                                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                                    window.location.reload();
                                }
                            }}
                            className="glass-panel p-1.5 bg-[#080808] rounded-lg transition-colors text-gray-400 hover:text-red-400 hover:bg-red-900/20 flex items-center justify-center"
                            title="清除本地数据"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                {/* Bottom Right Controls: Zoom Controls (Vertical) */}
                {!isPreviewMode && (
                    <div className="absolute bottom-6 right-6 z-20">
                        {/* Zoom Controls - Vertical Layout */}
                        <div className="glass-panel rounded-lg p-1 flex flex-col gap-1 bg-[#080808]/90 backdrop-blur">
                            <button onClick={handleZoomIn} className="p-2 rounded-md transition-all text-gray-400 hover:bg-[#333] hover:text-white" title="放大 (+)">
                                <ZoomIn size={18} />
                            </button>
                            <button onClick={handleZoomOut} className="p-2 rounded-md transition-all text-gray-400 hover:bg-[#333] hover:text-white" title="缩小 (-)">
                                <ZoomOut size={18} />
                            </button>
                            <button onClick={handleZoomFit} className="p-2 rounded-md transition-all text-gray-400 hover:bg-[#333] hover:text-white" title="适应屏幕 (0)">
                                <Home size={18} />
                            </button>
                            <button
                                onClick={() => {
                                    if (!document.fullscreenElement) {
                                        document.documentElement.requestFullscreen();
                                    } else {
                                        document.exitFullscreen();
                                    }
                                }}
                                className="p-2 rounded-md transition-all text-gray-400 hover:bg-[#333] hover:text-white"
                                title="全屏 (F11)"
                            >
                                <Maximize2 size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Preview Mode Exit Hint */}
                {isPreviewMode && (
                    <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur px-3 py-1.5 rounded text-xs text-gray-300 border border-white/10">
                        按 <kbd className="bg-[#333] px-1 rounded border border-[#444] text-[10px]">ESC</kbd> 退出预览
                    </div>
                )}

                {/* 框选覆盖层 - 视觉显示 */}
                {isBoxSelecting && selectionBox && (
                    <div
                        className="absolute z-30 border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                        style={{
                            left: Math.min(selectionBox.start.x, selectionBox.end.x),
                            top: Math.min(selectionBox.start.y, selectionBox.end.y),
                            width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                            height: Math.abs(selectionBox.end.y - selectionBox.start.y)
                        }}
                    />
                )}

                {/* 视角切换 Tab */}
                {!isPreviewMode && viewMode === '3d' && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-lg p-1 flex text-[11px] font-medium bg-[#080808] shadow-lg">
                        <button
                            onClick={() => setCameraView('perspective')}
                            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${cameraView === 'perspective' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Box size={14} />
                            <span>透视</span>
                        </button>
                        <button
                            onClick={() => setCameraView('top')}
                            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${cameraView === 'top' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Square size={14} />
                            <span>俯视</span>
                        </button>
                        <button
                            onClick={() => setCameraView('front')}
                            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${cameraView === 'front' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <LayoutTemplate size={14} />
                            <span>正视</span>
                        </button>
                    </div>
                )}

                <Canvas 
                    shadows 
                    dpr={[1, 2]} 
                    gl={{ 
                        antialias: true,
                        preserveDrawingBuffer: true,
                        powerPreference: 'high-performance'
                    }}
                    onCreated={({ gl }) => {
                        // 处理WebGL上下文丢失
                        gl.domElement.addEventListener('webglcontextlost', (e) => {
                            e.preventDefault();
                            console.warn('⚠️ WebGL上下文丢失，尝试恢复...');
                        });
                        gl.domElement.addEventListener('webglcontextrestored', () => {
                            console.log('✅ WebGL上下文已恢复');
                        });
                    }}
                >
                    {/* 获取 scene 引用 */}
                    <SceneRefGetter setSceneRef={setSceneRef} />

                    {/* 批量操作框选功能 - 暂时禁用，使用 SelectionManager */}
                    {false && (
                        <BoxSelectionIntegration
                            onSelectionChange={setBatchSelectedObjects}
                            enabled={true}
                        />
                    )}

                    {/* 框选逻辑管理器 */}
                    <SelectionManager
                        isBoxSelecting={isBoxSelecting}
                        setIsBoxSelecting={setIsBoxSelecting}
                        setSelectionBox={setSelectionBox}
                        toolMode={toolMode}
                        viewMode={viewMode}
                        objects={objects}
                        onSelect={(ids) => {
                            setSelectedIds(ids);
                            setSelectedId(ids.length > 0 ? ids[ids.length - 1] : null);
                        }}
                    />
                    <DragDropManager onDrop={handleDrop} />
                    <AdvancedDrawingManager mode={toolMode === 'select' || toolMode === 'draw_path' ? null : toolMode} onFinish={handleDrawFinish} enableSnap={enableSnap} />
                    <PathCreationManager
                        toolMode={toolMode}
                        objects={objects}
                        onAddPoint={(point) => {
                            const newObjects = [...objects, point];
                            setObjects(newObjects);
                            commitHistory(newObjects);
                        }}
                        onAddPath={(sourceId, targetId) => {
                            const newPath = createPath(sourceId, targetId);
                            const newObjects = [...objects, newPath];
                            setObjects(newObjects);
                            commitHistory(newObjects);
                        }}
                    />

                    {/* 2D 模式 */}
                    {false && viewMode === '2d' ? (
                        <>
                            {/* 2D 模式已隐藏 */}
                            <OrthographicCamera makeDefault position={[0, 100, 0]} zoom={cameraZoom.orthographic} rotation={[-Math.PI / 2, 0, 0]} />
                            <color attach="background" args={['#f5f5f5']} />
                            <ambientLight intensity={1} />

                            {/* 2D 网格 */}
                            <gridHelper args={[200, 200, '#d1d5db', '#e5e7eb']} position={[0, 0, 0]} />

                            {/* 坐标轴 */}
                            <CoordinateAxes />

                            {/* 2D 渲染器 */}
                            <Scene2DRenderer
                                objects={displayObjects}
                                selectedIds={selectedIds}
                                viewMode={viewMode}
                                onSelect={handleSelect}
                                width={60}
                                height={60}
                            />

                            {/* 可交互的对象（用于选择和变换） */}
                            < group onPointerMissed={() => {
                                if (toolMode === 'select') {
                                    setSelectedId(null);
                                    setSelectedIds([]);
                                    setBatchSelectedObjects([]); // 清空批量选择
                                }
                            }}>
                                {displayObjects.map(obj => (
                                    <Interactive2DObject
                                        key={obj.id}
                                        obj={obj}
                                        isSelected={selectedIds.includes(obj.id)}
                                        transformMode={selectedIds.length > 1 ? null : transformMode}
                                        toolMode={toolMode}
                                        onSelect={handleSelect}
                                        onTransformEnd={handleTransformEnd}
                                        cameraView={cameraView}
                                    />
                                ))}
                            </group>

                            {/* 2D 模式下的多选移动控制器 */}
                            {selectedIds.length > 1 && (
                                <MultiSelectTransformControls
                                    selectedObjects={displayObjects.filter(o => selectedIds.includes(o.id))}
                                    onDragStart={handleDragStart}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                    cameraView={cameraView}
                                    enableSnap={enableSnap}
                                />
                            )}

                            <OrbitControlsWithDragDetection
                                makeDefault
                                enableDamping
                                dampingFactor={0.05}
                                minDistance={1}
                                maxDistance={100}
                                // 2D模式下：左键框选（禁用Orbit），右键平移
                                // 3D模式下：左键旋转，右键平移
                                mouseButtons={viewMode === '2d' ? {
                                    LEFT: null, // 禁用左键，由自定义逻辑处理框选
                                    MIDDLE: THREE.MOUSE.DOLLY,
                                    RIGHT: THREE.MOUSE.PAN
                                } : {
                                    LEFT: THREE.MOUSE.ROTATE,
                                    MIDDLE: THREE.MOUSE.DOLLY,
                                    RIGHT: THREE.MOUSE.PAN
                                }}
                                enableRotate={viewMode === '3d'}
                                screenSpacePanning={true}
                                maxPolarAngle={viewMode === '2d' ? 0 : Math.PI / 2}
                                onDragChange={setIsCameraDragging}
                            />
                        </>
                    ) : (
                        <>
                            {/* 3D 模式 */}
                            <group onPointerMissed={() => {
                                if (toolMode === 'select') {
                                    setSelectedId(null);
                                    setSelectedIds([]);
                                    setBatchSelectedObjects([]); // 清空批量选择
                                }
                            }}>
                                {/* Render SLAM Base Map */}
                                {displayObjects.filter(obj => obj.isBaseMap && obj.type !== 'map_image').map(baseMap => (
                                    <BaseMapRenderer key={baseMap.id} baseMap={baseMap} />
                                ))}

                                {/* Render Map Images */}
                                {(() => {
                                    const mapImages = displayObjects.filter(obj => obj.type === 'map_image');
                                    console.log('🎨 渲染地图图片数量:', mapImages.length, mapImages.map(m => ({ name: m.name, visible: m.visible, imageData: !!m.imageData })));
                                    return mapImages.map(mapImg => (
                                        <MapImage
                                            key={mapImg.id}
                                            data={mapImg}
                                            isSelected={selectedIds.includes(mapImg.id) && !isPreviewMode}
                                            onSelect={(id, shiftKey) => {
                                                if (shiftKey) {
                                                    const newIds = selectedIds.includes(id)
                                                        ? selectedIds.filter(sid => sid !== id)
                                                        : [...selectedIds, id];
                                                    setSelectedIds(newIds);
                                                    setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                                                } else {
                                                    setSelectedId(id);
                                                    setSelectedIds([id]);
                                                }
                                            }}
                                        />
                                    ));
                                })()}

                                {/* Render Waypoints */}
                                {displayObjects.filter(obj => obj.type === 'waypoint').map(waypoint => (
                                    <WaypointMarker
                                        key={waypoint.id}
                                        data={waypoint}
                                        isSelected={selectedIds.includes(waypoint.id) && !isPreviewMode}
                                        onSelect={(id, shiftKey) => {
                                            if (shiftKey) {
                                                const newIds = selectedIds.includes(id)
                                                    ? selectedIds.filter(sid => sid !== id)
                                                    : [...selectedIds, id];
                                                setSelectedIds(newIds);
                                                setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                                            } else {
                                                setSelectedId(id);
                                                setSelectedIds([id]);
                                            }
                                        }}
                                    />
                                ))}

                                {/* Render Path Lines */}
                                {displayObjects.filter(obj => obj.type === 'path_line').map(path => (
                                    <PathLine
                                        key={path.id}
                                        data={path}
                                        isSelected={selectedIds.includes(path.id) && !isPreviewMode}
                                        onSelect={(id, shiftKey) => {
                                            if (shiftKey) {
                                                const newIds = selectedIds.includes(id)
                                                    ? selectedIds.filter(sid => sid !== id)
                                                    : [...selectedIds, id];
                                                setSelectedIds(newIds);
                                                setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                                            } else {
                                                setSelectedId(id);
                                                setSelectedIds([id]);
                                            }
                                        }}
                                    />
                                ))}

                                {/* Render other objects */}
                                {displayObjects.filter(obj => !obj.isBaseMap && obj.type !== 'map_image' && obj.type !== 'waypoint' && obj.type !== 'path_line' && obj.type !== 'group').map(obj => (
                                    <SceneObject
                                        key={obj.id}
                                        data={obj}
                                        baseMapData={currentFloorLevel?.baseMapData}
                                        isSelected={selectedIds.includes(obj.id) && !isPreviewMode}
                                        isEditingPoints={isEditingPoints && selectedIds.includes(obj.id)}
                                        onSelect={(id, shiftKey) => {
                                            if (shiftKey) {
                                                // Shift+Click: 多选模式
                                                const newIds = selectedIds.includes(id)
                                                    ? selectedIds.filter(sid => sid !== id)
                                                    : [...selectedIds, id];
                                                setSelectedIds(newIds);
                                                setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                                            } else {
                                                // 普通点击: 单选
                                                setSelectedId(id);
                                                setSelectedIds([id]);
                                            }
                                        }}
                                        transformMode={selectedIds.length > 1 ? null : (toolMode === 'select' ? transformMode : null)}
                                        onTransformEnd={handleTransformEnd}
                                        onUpdatePoints={updatePoints}
                                        onToggleEdit={toggleEditMode}
                                        cameraView={cameraView}
                                        enableSnap={enableSnap}
                                    />
                                ))}
                                
                                {/* 渲染组对象的包围盒 */}
                                {displayObjects.filter(obj => obj.type === 'group').map(group => {
                                    const groupChildren = displayObjects.filter(child => child.parentId === group.id);
                                    return (
                                        <GroupBoundingBox
                                            key={group.id}
                                            group={group}
                                            children={groupChildren}
                                            isSelected={selectedIds.includes(group.id) && !isPreviewMode}
                                            onSelect={handleSelect}
                                        />
                                    );
                                })}
                            </group>

                            {/* 多选组移动控制器 - 也用于单个组对象 */}
                            {selectedIds.length > 0 && !isPreviewMode && (() => {
                                // 检查是否选中了组对象或多个对象
                                const hasGroupSelected = selectedIds.some(id => {
                                    const obj = objects.find(o => o.id === id);
                                    return obj && obj.type === 'group';
                                });
                                const shouldShowMultiSelect = selectedIds.length > 1 || hasGroupSelected;
                                
                                if (!shouldShowMultiSelect) return null;
                                
                                return (
                                    <MultiSelectTransformControls
                                        selectedObjects={displayObjects.filter(o => selectedIds.includes(o.id))}
                                        onDragStart={handleDragStart}
                                        onDrag={handleDrag}
                                        onDragEnd={handleDragEnd}
                                        cameraView={cameraView}
                                        enableSnap={enableSnap}
                                    />
                                );
                            })()}

                            {viewMode === '3d' && (
                                <OrbitControlsWithDragDetection
                                    makeDefault
                                    enableDamping
                                    dampingFactor={0.1}
                                    enabled={toolMode === 'select' && !isEditingPoints && !isBoxSelecting}
                                    enableRotate={cameraView === 'perspective'}
                                    mouseButtons={{
                                        LEFT: null,           // 左键留给选择和框选
                                        MIDDLE: THREE.MOUSE.DOLLY,  // 中键缩放
                                        RIGHT: THREE.MOUSE.ROTATE   // 右键旋转视角
                                    }}
                                />
                            )}
                            {/* Only render ONE camera at a time to prevent flickering */}
                            {cameraView === 'perspective' ? (
                                <PerspectiveCamera makeDefault position={[cameraZoom.perspective, cameraZoom.perspective, cameraZoom.perspective]} fov={45} />
                            ) : cameraView === 'top' ? (
                                <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={cameraZoom.orthographic * 10} rotation={[-Math.PI / 2, 0, 0]} />
                            ) : cameraView === 'front' ? (
                                <OrthographicCamera makeDefault position={[0, 0, 30]} zoom={cameraZoom.orthographic * 10} />
                            ) : null}
                            <color attach="background" args={['#1a1a1a']} />
                            <ambientLight intensity={0.8} />
                            <directionalLight position={[10, 20, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
                            <directionalLight position={[-10, 10, -5]} intensity={0.6} />
                            <hemisphereLight args={['#ffffff', '#555555', 0.5]} />
                            {!isPreviewMode && <InfiniteGrid />}
                            <ContactShadows opacity={0.4} scale={50} blur={2} far={4} resolution={256} color="#000" />
                        </>
                    )}
                </Canvas>
            </div>

            {/* Right Panel */}
            {
                !isPreviewMode && isPanelVisible && (
                    <div className="w-72 bg-[#0f0f0f] border-l border-[#1a1a1a] flex flex-col overflow-y-auto">
                        {batchSelected.length > 0 && selectedIds.length > 1 ? (
                            <div className="pb-10">
                                {/* 批量操作面板 - 固定标题 */}
                                <div className="sticky top-0 z-10 p-4 border-b border-[#1a1a1a] bg-[#0f0f0f]">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded flex items-center justify-center text-blue-400">
                                            <CopyCheck size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white">批量操作</div>
                                            <div className="text-[10px] text-gray-500">已选择 {batchSelected.length} 个对象</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 对齐工具 - 优化UI */}
                                <div className="p-4 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-3 px-1">对齐工具</div>
                                    <div className="grid grid-cols-7 gap-2 mb-2">
                                        {/* 左对齐 */}
                                        <button
                                            onClick={() => {
                                                const minX = Math.min(...selectedIds.map(id => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return obj?.position[0] || 0;
                                                }));
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        return { ...obj, position: [minX, obj.position[1], obj.position[2]] };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-2 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title="左对齐"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="3" y1="6" x2="3" y2="18" />
                                                <rect x="7" y="8" width="6" height="8" />
                                            </svg>
                                            <span>左</span>
                                        </button>

                                        {/* 居中对齐 */}
                                        <button
                                            onClick={() => {
                                                const avgX = selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.position[0] || 0);
                                                }, 0) / selectedIds.length;
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        return { ...obj, position: [avgX, obj.position[1], obj.position[2]] };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-3 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title="水平居中对齐"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="12" y1="6" x2="12" y2="18" />
                                                <rect x="8" y="8" width="8" height="8" />
                                            </svg>
                                            <span>水平居中</span>
                                        </button>

                                        {/* 右对齐 */}
                                        <button
                                            onClick={() => {
                                                const maxX = Math.max(...selectedIds.map(id => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return obj?.position[0] || 0;
                                                }));
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        return { ...obj, position: [maxX, obj.position[1], obj.position[2]] };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-2 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title="右对齐"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="21" y1="6" x2="21" y2="18" />
                                                <rect x="11" y="8" width="6" height="8" />
                                            </svg>
                                            <span>右</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">

                                        {/* 上对齐 - 根据相机视角自动选择轴向 */}
                                        <button
                                            onClick={() => {
                                                // 俯视图: Z轴最小值（屏幕上方）, 透视图/前视图: Y轴最大值（垂直向上）
                                                const axisIndex = cameraView === 'top' ? 2 : 1;
                                                
                                                // 计算每个物体的实际顶部/底部位置
                                                const getEdgePosition = (obj, isTop) => {
                                                    const centerPos = obj.position[axisIndex] || 0;
                                                    // 对于原点在中心的物体，需要加上/减去半个尺寸
                                                    if (['wall', 'column', 'door', 'cube'].includes(obj.type)) {
                                                        const halfSize = (obj.scale[axisIndex] || 1) / 2;
                                                        return isTop ? centerPos + halfSize : centerPos - halfSize;
                                                    }
                                                    // 其他物体原点在底部
                                                    return centerPos;
                                                };
                                                
                                                const targetValue = cameraView === 'top' 
                                                    ? Math.min(...selectedIds.map(id => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return getEdgePosition(obj, false); // 俯视图：最小值是上方
                                                    }))
                                                    : Math.max(...selectedIds.map(id => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return getEdgePosition(obj, true); // 透视图：最大值是上方
                                                    }));
                                                
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        // 计算新的中心位置
                                                        if (['wall', 'column', 'door', 'cube'].includes(obj.type)) {
                                                            const halfSize = (obj.scale[axisIndex] || 1) / 2;
                                                            newPos[axisIndex] = cameraView === 'top' 
                                                                ? targetValue + halfSize 
                                                                : targetValue - halfSize;
                                                        } else {
                                                            newPos[axisIndex] = targetValue;
                                                        }
                                                        return { ...obj, position: newPos };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-2 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title={cameraView === 'top' ? '上对齐 (顶部对齐)' : '上对齐 (顶部对齐)'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="6" y1="3" x2="18" y2="3" />
                                                <rect x="8" y="7" width="8" height="6" />
                                            </svg>
                                            <span>上</span>
                                        </button>

                                        {/* 垂直居中对齐 - 根据相机视角自动选择轴向 */}
                                        <button
                                            onClick={() => {
                                                const axisIndex = cameraView === 'top' ? 2 : 1;
                                                const avgValue = selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.position[axisIndex] || 0);
                                                }, 0) / selectedIds.length;
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        newPos[axisIndex] = avgValue;
                                                        return { ...obj, position: newPos };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-3 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title={cameraView === 'top' ? '垂直居中对齐 (Z轴)' : '垂直居中对齐 (Y轴)'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="6" y1="12" x2="18" y2="12" />
                                                <rect x="8" y="8" width="8" height="8" />
                                            </svg>
                                            <span>垂直居中</span>
                                        </button>

                                        {/* 下对齐 - 根据相机视角自动选择轴向 */}
                                        <button
                                            onClick={() => {
                                                // 俯视图: Z轴最大值（屏幕下方）, 透视图/前视图: Y轴最小值（垂直向下）
                                                const axisIndex = cameraView === 'top' ? 2 : 1;
                                                
                                                // 计算每个物体的实际底部位置
                                                const getEdgePosition = (obj, isTop) => {
                                                    const centerPos = obj.position[axisIndex] || 0;
                                                    // 对于原点在中心的物体，需要加上/减去半个尺寸
                                                    if (['wall', 'column', 'door', 'cube'].includes(obj.type)) {
                                                        const halfSize = (obj.scale[axisIndex] || 1) / 2;
                                                        return isTop ? centerPos + halfSize : centerPos - halfSize;
                                                    }
                                                    // 其他物体原点在底部
                                                    return centerPos;
                                                };
                                                
                                                const targetValue = cameraView === 'top' 
                                                    ? Math.max(...selectedIds.map(id => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return getEdgePosition(obj, true); // 俯视图：最大值是下方
                                                    }))
                                                    : Math.min(...selectedIds.map(id => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return getEdgePosition(obj, false); // 透视图：最小值是下方
                                                    }));
                                                
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        // 计算新的中心位置
                                                        if (['wall', 'column', 'door', 'cube'].includes(obj.type)) {
                                                            const halfSize = (obj.scale[axisIndex] || 1) / 2;
                                                            newPos[axisIndex] = cameraView === 'top' 
                                                                ? targetValue - halfSize 
                                                                : targetValue + halfSize;
                                                        } else {
                                                            newPos[axisIndex] = targetValue;
                                                        }
                                                        return { ...obj, position: newPos };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="col-span-2 px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title={cameraView === 'top' ? '下对齐 (底部对齐)' : '下对齐 (底部对齐)'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="6" y1="21" x2="18" y2="21" />
                                                <rect x="8" y="11" width="8" height="6" />
                                            </svg>
                                            <span>下</span>
                                        </button>
                                    </div>
                                    
                                    {/* 水平和垂直均分 */}
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button
                                            onClick={() => {
                                                // 水平均分 - X轴均匀分布
                                                if (selectedIds.length < 3) {
                                                    alert('需要至少3个对象才能均分');
                                                    return;
                                                }
                                                const sorted = [...selectedIds].sort((a, b) => {
                                                    const objA = objects.find(o => o.id === a);
                                                    const objB = objects.find(o => o.id === b);
                                                    return (objA?.position[0] || 0) - (objB?.position[0] || 0);
                                                });
                                                const firstX = objects.find(o => o.id === sorted[0])?.position[0] || 0;
                                                const lastX = objects.find(o => o.id === sorted[sorted.length - 1])?.position[0] || 0;
                                                const gap = (lastX - firstX) / (sorted.length - 1);

                                                const newObjects = objects.map(obj => {
                                                    const index = sorted.indexOf(obj.id);
                                                    if (index !== -1) {
                                                        return { ...obj, position: [firstX + gap * index, obj.position[1], obj.position[2]] };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title="水平均分 (X轴)"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="9" width="4" height="6" />
                                                <rect x="10" y="9" width="4" height="6" />
                                                <rect x="17" y="9" width="4" height="6" />
                                            </svg>
                                            <span>水平均分</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                // 垂直均分 - Z轴均匀分布
                                                if (selectedIds.length < 3) {
                                                    alert('需要至少3个对象才能均分');
                                                    return;
                                                }
                                                const axisIndex = cameraView === 'top' ? 2 : 1;
                                                const sorted = [...selectedIds].sort((a, b) => {
                                                    const objA = objects.find(o => o.id === a);
                                                    const objB = objects.find(o => o.id === b);
                                                    return (objA?.position[axisIndex] || 0) - (objB?.position[axisIndex] || 0);
                                                });
                                                const firstValue = objects.find(o => o.id === sorted[0])?.position[axisIndex] || 0;
                                                const lastValue = objects.find(o => o.id === sorted[sorted.length - 1])?.position[axisIndex] || 0;
                                                const gap = (lastValue - firstValue) / (sorted.length - 1);

                                                const newObjects = objects.map(obj => {
                                                    const index = sorted.indexOf(obj.id);
                                                    if (index !== -1) {
                                                        const newPos = [...obj.position];
                                                        newPos[axisIndex] = firstValue + gap * index;
                                                        return { ...obj, position: newPos };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="px-3 py-2 rounded bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white hover:border-blue-500 transition-all text-xs flex items-center justify-center gap-1"
                                            title={cameraView === 'top' ? '垂直均分 (Z轴)' : '垂直均分 (Y轴)'}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="3" width="6" height="4" />
                                                <rect x="9" y="10" width="6" height="4" />
                                                <rect x="9" y="17" width="6" height="4" />
                                            </svg>
                                            <span>垂直均分</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 批量转换资产 - 使用切换模型样式 */}
                                <div className="p-4 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                                    <div className="bg-[#161616] p-3 rounded-lg border border-[#2a2a2a]">
                                        <div className="text-[10px] text-gray-500 mb-3 flex items-center gap-1"><RefreshCw size={10} /> 切换模型 </div>
                                        <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                console.log('批量转换CNC - 选中对象数:', selectedIds.length);
                                                try {
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            const newPos = [...obj.position];
                                                            // CNC原点在底部，Y=0即可
                                                            newPos[1] = 0;
                                                            return {
                                                                ...obj,
                                                                type: 'cnc',
                                                                modelUrl: `${import.meta.env.BASE_URL}cnc.glb`,
                                                                modelScale: 1,
                                                                name: `CNC加工中心`,
                                                                scale: [1, 1, 1],
                                                                position: newPos,
                                                                rotation: [0, 0, 0]
                                                            };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                    console.log('批量转换CNC完成');
                                                } catch (error) {
                                                    console.error('批量转换CNC失败:', error);
                                                }
                                            }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                        >
                                            <Server size={20} />
                                            <span className="text-[10px]">CNC</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        // 占位方块原点在中心，抬高半个高度
                                                        newPos[1] = 0.5;
                                                        return {
                                                            ...obj,
                                                            type: 'cube',
                                                            modelUrl: null,
                                                            name: `占位方块`,
                                                            scale: [1, 1, 1],
                                                            position: newPos,
                                                            rotation: [0, 0, 0]
                                                        };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                        >
                                            <Box size={20} />
                                            <span className="text-[10px]">占位方块</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        // 柱子原点在中心，高度4米，抬高2米
                                                        newPos[1] = 2;
                                                        return {
                                                            ...obj,
                                                            type: 'column',
                                                            modelUrl: null,
                                                            name: `标准柱子`,
                                                            scale: [0.6, 4, 0.6],
                                                            position: newPos,
                                                            rotation: [0, 0, 0]
                                                        };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                        >
                                            <Columns size={20} />
                                            <span className="text-[10px]">柱子</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newObjects = objects.map(obj => {
                                                    if (selectedIds.includes(obj.id)) {
                                                        const newPos = [...obj.position];
                                                        // 墙体原点在中心，高度3米，抬高1.5米
                                                        newPos[1] = 1.5;
                                                        return {
                                                            ...obj,
                                                            type: 'wall',
                                                            modelUrl: null,
                                                            name: `标准墙体`,
                                                            scale: [4, 3, 0.2],
                                                            position: newPos,
                                                            rotation: [0, 0, 0]
                                                        };
                                                    }
                                                    return obj;
                                                });
                                                setObjects(newObjects);
                                                commitHistory(newObjects);
                                            }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                        >
                                            <BrickWall size={20} />
                                            <span className="text-[10px]">墙体</span>
                                        </button>
                                        </div>
                                        
                                        {/* 自定义资产 */}
                                        {customAssets.length > 0 && (
                                            <>
                                                <div className="text-[10px] text-gray-500 mt-3 mb-2">自定义资产:</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {customAssets.map((asset, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const newObjects = objects.map(obj => {
                                                                    if (selectedIds.includes(obj.id)) {
                                                                        return {
                                                                            ...obj,
                                                                            type: 'custom_model',
                                                                            modelUrl: asset.modelUrl,
                                                                            modelScale: asset.modelScale || 1,
                                                                            name: asset.label,
                                                                            assetId: asset.id
                                                                        };
                                                                    }
                                                                    return obj;
                                                                });
                                                                setObjects(newObjects);
                                                                commitHistory(newObjects);
                                                            }}
                                                            className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                                            title={asset.label}
                                                        >
                                                            <Box size={16} />
                                                            <span className="text-[9px] truncate w-full text-center">{asset.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 位置属性 */}
                                <PropSection title="位置">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">位置 X</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.position[0] || 0);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.position[0] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = val - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, position: [obj.position[0] + offset, obj.position[1], obj.position[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">位置 Y</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.position[1] || 0);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.position[1] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = val - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, position: [obj.position[0], obj.position[1] + offset, obj.position[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">位置 Z</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.position[2] || 0);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.position[2] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = val - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, position: [obj.position[0], obj.position[1], obj.position[2] + offset] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </PropSection>

                                {/* 旋转属性 */}
                                <PropSection title="旋转">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">旋转 X</label>
                                            <SmartInput
                                                value={parseFloat((Math.round((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.rotation[0] || 0);
                                                }, 0) / selectedIds.length) * 180 / Math.PI)).toFixed(0))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.rotation[0] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = (val * Math.PI / 180) - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, rotation: [obj.rotation[0] + offset, obj.rotation[1], obj.rotation[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">旋转 Y</label>
                                            <SmartInput
                                                value={parseFloat((Math.round((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.rotation[1] || 0);
                                                }, 0) / selectedIds.length) * 180 / Math.PI)).toFixed(0))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.rotation[1] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = (val * Math.PI / 180) - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, rotation: [obj.rotation[0], obj.rotation[1] + offset, obj.rotation[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">旋转 Z</label>
                                            <SmartInput
                                                value={parseFloat((Math.round((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.rotation[2] || 0);
                                                }, 0) / selectedIds.length) * 180 / Math.PI)).toFixed(0))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.rotation[2] || 0);
                                                    }, 0) / selectedIds.length;
                                                    const offset = (val * Math.PI / 180) - avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, rotation: [obj.rotation[0], obj.rotation[1], obj.rotation[2] + offset] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </PropSection>

                                {/* 缩放属性 */}
                                <PropSection title="缩放">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">缩放 X</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.scale[0] || 1);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.scale[0] || 1);
                                                    }, 0) / selectedIds.length;
                                                    const ratio = val / avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, scale: [obj.scale[0] * ratio, obj.scale[1], obj.scale[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">缩放 Y</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.scale[1] || 1);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.scale[1] || 1);
                                                    }, 0) / selectedIds.length;
                                                    const ratio = val / avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, scale: [obj.scale[0], obj.scale[1] * ratio, obj.scale[2]] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[11px] text-gray-500 w-16 shrink-0">缩放 Z</label>
                                            <SmartInput
                                                value={parseFloat((selectedIds.reduce((sum, id) => {
                                                    const obj = objects.find(o => o.id === id);
                                                    return sum + (obj?.scale[2] || 1);
                                                }, 0) / selectedIds.length).toFixed(2))}
                                                onChange={(val) => {
                                                    const avg = selectedIds.reduce((sum, id) => {
                                                        const obj = objects.find(o => o.id === id);
                                                        return sum + (obj?.scale[2] || 1);
                                                    }, 0) / selectedIds.length;
                                                    const ratio = val / avg;
                                                    const newObjects = objects.map(obj => {
                                                        if (selectedIds.includes(obj.id)) {
                                                            return { ...obj, scale: [obj.scale[0], obj.scale[1], obj.scale[2] * ratio] };
                                                        }
                                                        return obj;
                                                    });
                                                    setObjects(newObjects);
                                                    commitHistory(newObjects);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </PropSection>

                                {/* 操作按钮 */}
                                <PropSection title="操作">
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => {
                                                const newIds = handleBatchDuplicate(selectedIds);
                                                if (newIds) {
                                                    setSelectedIds(newIds);
                                                    setBatchSelectedObjects([]);
                                                }
                                            }}
                                            className="w-full py-2 px-3 rounded-md bg-[#1a1a1a] text-gray-300 border border-[#2a2a2a] hover:bg-[#252525] text-xs font-medium transition-all flex items-center justify-center gap-2"
                                        >
                                            <Copy size={14} /> 复制
                                        </button>

                                        <button
                                            onClick={() => {
                                                const groupId = handleBatchGroup(selectedIds);
                                                if (groupId) {
                                                    setSelectedIds([groupId]);
                                                    setSelectedId(groupId);
                                                    setBatchSelectedObjects([]);
                                                }
                                            }}
                                            className="w-full py-2 px-3 rounded-md bg-[#1a1a1a] text-gray-300 border border-[#2a2a2a] hover:bg-[#252525] text-xs font-medium transition-all flex items-center justify-center gap-2"
                                            title="组合选中对象 (Cmd/Ctrl+G)"
                                        >
                                            <Layers size={14} /> 组合
                                        </button>

                                        {selectedIds.length === 1 && objects.find(o => o.id === selectedIds[0])?.type === 'group' && (
                                            <button
                                                onClick={() => {
                                                    handleUngroup(selectedIds[0]);
                                                    setBatchSelectedObjects([]);
                                                }}
                                                className="w-full py-2 px-3 rounded-md bg-[#1a1a1a] text-purple-400 border border-purple-500/30 hover:bg-purple-900/20 text-xs font-medium transition-all flex items-center justify-center gap-2"
                                                title="解组 (Cmd/Ctrl+Shift+G)"
                                            >
                                                <Layers size={14} /> 解组
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                handleBatchDelete(selectedIds);
                                                setSelectedIds([]);
                                                setSelectedId(null);
                                                setBatchSelectedObjects([]);
                                            }}
                                            className="w-full py-2 px-3 rounded-md bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-900/40 text-xs font-medium transition-all flex items-center justify-center gap-2"
                                        >
                                            <Trash2 size={14} /> 删除选中
                                        </button>
                                    </div>
                                </PropSection>
                            </div>
                        ) : selectedObject ? (
                            <div className="pb-10">
                                {/* 对象属性面板 - 固定标题 */}
                                <div className="sticky top-0 z-10 p-4 border-b border-[#1a1a1a] bg-[#0f0f0f]">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-[#1a1a1a] border border-[#333] rounded flex items-center justify-center text-blue-500">
                                            {selectedObject.type.includes('wall') ? <BrickWall size={16} /> : <BoxIcon size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <input className="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-blue-500 transition-colors" value={selectedObject.name} onChange={(e) => updateObject(selectedId, 'name', e.target.value)} />
                                            <div className="text-[10px] text-gray-600 mt-0.5">ID: {selectedObject.id.slice(0, 8)}</div>
                                        </div>
                                    </div>
                                    {/* 编辑点位按钮 - 仅对 curved_wall 和 polygon_floor 显示 */}
                                    {(selectedObject.type === 'curved_wall' || selectedObject.type === 'polygon_floor') && (
                                        <button
                                            onClick={() => toggleEditMode(selectedId)}
                                            className={`w-full py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${isEditingPoints
                                                ? 'bg-blue-600 text-white border border-blue-500'
                                                : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:bg-[#252525] hover:text-white'
                                                }`}
                                        >
                                            <Edit3 size={14} />
                                            {isEditingPoints ? '完成编辑' : '编辑点位'}
                                        </button>
                                    )}
                                </div>
                                {['cnc', 'column', 'door', 'custom_model'].includes(selectedObject.type) && (
                                    <div className="border-b border-[#1a1a1a]">
                                    <div className="px-4 py-3 space-y-3 bg-[#0e0e0e]">
                                        {selectedObject.modelUrl && (
                                            <div className="mb-3">
                                                <div className="text-[11px] text-gray-500 mb-2">模型缩放</div>
                                                <div className="flex flex-col w-full gap-2">
                                                    <div className="flex items-center gap-2 w-full">
                                                        <input 
                                                            type="range" 
                                                            min="0.001" 
                                                            max="10" 
                                                            step="0.001" 
                                                            value={selectedObject.modelScale || 1} 
                                                            onChange={(e) => updateObject(selectedId, 'modelScale', parseFloat(e.target.value))} 
                                                            className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                                        />
                                                        <input
                                                            type="number"
                                                            value={selectedObject.modelScale || 1}
                                                            onChange={(e) => updateObject(selectedId, 'modelScale', parseFloat(e.target.value) || 0.1)}
                                                            step="0.001"
                                                            className="w-20 shrink-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors text-center"
                                                        />
                                                    </div>
                                                    <div className="flex w-full bg-[#1a1a1a] rounded overflow-hidden border border-[#2a2a2a]">
                                                        <button 
                                                            onClick={() => updateObject(selectedId, 'modelScale', 0.001)} 
                                                            className="flex-1 py-1.5 hover:bg-[#333] text-[10px] font-medium text-gray-500 hover:text-white transition-colors border-r border-[#2a2a2a]" 
                                                            title="毫米单位"
                                                        >
                                                            mm
                                                        </button>
                                                        <button 
                                                            onClick={() => updateObject(selectedId, 'modelScale', 0.01)} 
                                                            className="flex-1 py-1.5 hover:bg-[#333] text-[10px] font-medium text-gray-500 hover:text-white transition-colors border-r border-[#2a2a2a]" 
                                                            title="厘米单位"
                                                        >
                                                            cm
                                                        </button>
                                                        <button 
                                                            onClick={() => updateObject(selectedId, 'modelScale', 1)} 
                                                            className="flex-1 py-1.5 hover:bg-[#333] text-[10px] font-medium text-gray-500 hover:text-white transition-colors" 
                                                            title="米单位"
                                                        >
                                                            m
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                )}

                                {['waypoint', 'cube', 'cnc', 'column', 'door', 'custom_model'].includes(selectedObject.type) && (
                                    <div className="border-b border-[#1a1a1a]">
                                    <div className="px-4 py-3 space-y-3 bg-[#0e0e0e]">
                                        <div className="bg-[#161616] p-3 rounded-lg border border-[#2a2a2a] text-center">
                                            <div className="text-[10px] text-gray-500 mb-3 text-left flex items-center gap-1"><RefreshCw size={10} /> 切换模型 (Switch Model):</div>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <button
                                                    onClick={() => {
                                                        const asset = defaultAssets.find(a => a.type === 'cnc');
                                                        if (asset) {
                                                            const updated = {
                                                                ...selectedObject,
                                                                type: 'cnc',
                                                                modelUrl: asset.modelUrl || null,
                                                                modelScale: asset.modelScale || 1,
                                                                name: `${asset.label} - ${selectedObject.name}`
                                                            };
                                                            commitHistory(objects.map(o => o.id === selectedId ? updated : o));
                                                        }
                                                    }}
                                                    className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                                >
                                                    <Server size={20} />
                                                    <span className="text-[10px]">CNC</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const asset = defaultAssets.find(a => a.type === 'cube');
                                                        if (asset) {
                                                            const updated = {
                                                                ...selectedObject,
                                                                type: 'cube',
                                                                modelUrl: null,
                                                                scale: [1, 1, 1],
                                                                name: `${asset.label} - ${selectedObject.name}`
                                                            };
                                                            commitHistory(objects.map(o => o.id === selectedId ? updated : o));
                                                        }
                                                    }}
                                                    className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                                >
                                                    <Box size={20} />
                                                    <span className="text-[10px]">占位方块</span>
                                                </button>
                                            </div>
                                            {customAssets.length > 0 && (
                                                <>
                                                    <div className="text-[10px] text-gray-500 mb-2 text-left">自定义资产:</div>
                                                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                                        {customAssets.map((asset, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    const updated = {
                                                                        ...selectedObject,
                                                                        type: 'custom_model',
                                                                        modelUrl: asset.modelUrl,
                                                                        modelScale: asset.modelScale || 1,
                                                                        name: `${asset.label} - ${selectedObject.name}`
                                                                    };
                                                                    commitHistory(objects.map(o => o.id === selectedId ? updated : o));
                                                                }}
                                                                className="flex flex-col items-center justify-center p-2 rounded border border-[#333] text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-all"
                                                                title={asset.label}
                                                            >
                                                                <Box size={16} className="mb-1" />
                                                                <span className="text-[9px] w-full truncate">{asset.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    </div>
                                )}

                                {selectedObject.type === 'point' && (
                                    <PropSection title="点属性">
                                        <PropRow label="类型">
                                            <select
                                                value={selectedObject.subtype || 'waypoint'}
                                                onChange={(e) => updateObject(selectedId, 'subtype', e.target.value)}
                                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                            >
                                                <option value="waypoint">路径点 (Waypoint)</option>
                                                <option value="station">站点 (Station)</option>
                                                <option value="charger">充电桩 (Charger)</option>
                                            </select>
                                        </PropRow>
                                    </PropSection>
                                )}

                                {selectedObject.type === 'path' && (
                                    <PropSection title="路径属性">
                                        <PropRow label="宽度">
                                            <input
                                                type="number"
                                                value={selectedObject.width || 0.2}
                                                onChange={(e) => updateObject(selectedId, 'width', parseFloat(e.target.value))}
                                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </PropRow>
                                        <PropRow label="速度限制">
                                            <input
                                                type="number"
                                                value={selectedObject.speedLimit || 1.0}
                                                onChange={(e) => updateObject(selectedId, 'speedLimit', parseFloat(e.target.value))}
                                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </PropRow>
                                        <PropRow label="方向">
                                            <select
                                                value={selectedObject.direction || 'bidirectional'}
                                                onChange={(e) => updateObject(selectedId, 'direction', e.target.value)}
                                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                            >
                                                <option value="bidirectional">双向 (Bidirectional)</option>
                                                <option value="unidirectional">单向 (Unidirectional)</option>
                                            </select>
                                        </PropRow>
                                    </PropSection>
                                )}

                                {/* 业务数据面板 - 仅对从数据源导入的点位显示 */}
                                {(selectedObject.type === 'waypoint' && selectedObject.sourceRefId) && (
                                    <PropSection title="业务数据">
                                        <PropRow label="状态">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="text-xs text-gray-300">运行中 (Online)</span>
                                            </div>
                                        </PropRow>
                                        <PropRow label="数据源">
                                            <div className="flex items-center gap-2 bg-[#1a1a1a] px-2 py-1 rounded border border-[#333] w-full">
                                                <Database size={10} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-400">MQTT_Device_01</span>
                                            </div>
                                        </PropRow>
                                        <PropRow label="标签">
                                            <div className="flex gap-1">
                                                <span className="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded text-[9px] border border-blue-800/50">车间A</span>
                                                <span className="bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded text-[9px] border border-purple-800/50">关键设备</span>
                                            </div>
                                        </PropRow>
                                    </PropSection>
                                )}

                                <div>
                                <div className="px-4 py-3 space-y-3 bg-[#0e0e0e]">
                                    {selectedObject.type === 'curved_wall' && (
                                        <>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-16">高度 (H)</label>
                                                    <input
                                                        type="number"
                                                        value={(selectedObject.height || 3).toFixed(2)}
                                                        onChange={(e) => updateObject(selectedId, 'height', parseFloat(e.target.value) || 3)}
                                                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                                    />
                                                    <span className="text-[10px] text-gray-600 w-6">m</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-16">厚度 (W)</label>
                                                    <input
                                                        type="number"
                                                        value={(selectedObject.thickness || 0.2).toFixed(2)}
                                                        onChange={(e) => updateObject(selectedId, 'thickness', parseFloat(e.target.value) || 0.2)}
                                                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                                    />
                                                    <span className="text-[10px] text-gray-600 w-6">m</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-16">张力</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={selectedObject.tension !== undefined ? selectedObject.tension : 0.5}
                                                        onChange={(e) => updateObject(selectedId, 'tension', parseFloat(e.target.value))}
                                                        className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                    <span className="text-xs text-gray-400 w-8 text-right">{selectedObject.tension !== undefined ? selectedObject.tension : 0.5}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-16">闭合</label>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedObject.closed || false}
                                                        onChange={(e) => updateObject(selectedId, 'closed', e.target.checked)}
                                                        className="accent-blue-500 w-4 h-4"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {['wall', 'column', 'door'].includes(selectedObject.type) && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Ruler size={12} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">尺寸</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">长度 L</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[0].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 0, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">高度 H</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[1].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 1, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">厚度 W</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[2].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 2, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {['cnc', 'floor', 'custom_model'].includes(selectedObject.type) && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Ruler size={12} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">尺寸</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">X</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[0].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 0, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">Y</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[1].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 1, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 block mb-1">Z</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[2].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 2, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>
                                {!isEditingPoints && selectedObject.type !== 'path' && (<><div>
                                <div className="px-4 py-3 space-y-3 bg-[#0e0e0e]">
                                    {/* 位置 Position - 基础地图不显示 */}
                                    {!selectedObject.isBaseMap && (
                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Move size={12} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">位置</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">位置 X</label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.position[0].toFixed(2)}
                                                        onChange={(e) => updateTransform(selectedId, 'position', 0, parseFloat(e.target.value) || 0)}
                                                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">位置 Y</label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.position[1].toFixed(2)}
                                                        onChange={(e) => updateTransform(selectedId, 'position', 1, parseFloat(e.target.value) || 0)}
                                                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">位置 Z</label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.position[2].toFixed(2)}
                                                        onChange={(e) => updateTransform(selectedId, 'position', 2, parseFloat(e.target.value) || 0)}
                                                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 旋转角度 Rotation - 基础地图不显示 */}
                                    {!selectedObject.isBaseMap && (
                                        <div className="space-y-2 mb-4 pt-3 border-t border-[#1a1a1a]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <RotateCw size={12} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">旋转角度</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">旋转 X</label>
                                                    <SmartInput
                                                        value={parseFloat((selectedObject.rotation[0] * 180 / Math.PI).toFixed(1))}
                                                        onChange={(val) => updateTransform(selectedId, 'rotation', 0, val * Math.PI / 180)}
                                                        suffix="°"
                                                        step={1}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">旋转 Y</label>
                                                    <SmartInput
                                                        value={parseFloat((selectedObject.rotation[1] * 180 / Math.PI).toFixed(1))}
                                                        onChange={(val) => updateTransform(selectedId, 'rotation', 1, val * Math.PI / 180)}
                                                        suffix="°"
                                                        step={1}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">旋转 Z</label>
                                                    <SmartInput
                                                        value={parseFloat((selectedObject.rotation[2] * 180 / Math.PI).toFixed(1))}
                                                        onChange={(val) => updateTransform(selectedId, 'rotation', 2, val * Math.PI / 180)}
                                                        suffix="°"
                                                        step={1}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 缩放 Scale - 点不显示 */}
                                    {selectedObject.type !== 'point' && (
                                        <div className="space-y-2 pt-3 border-t border-[#1a1a1a]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Maximize size={12} className="text-gray-500" />
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">缩放</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">X</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[0].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 0, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">Y</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[1].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 1, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-gray-400 w-12">Z</label>
                                                    <SmartInput
                                                        value={parseFloat(selectedObject.scale[2].toFixed(2))}
                                                        onChange={(val) => updateTransform(selectedId, 'scale', 2, val)}
                                                        min={0.01}
                                                        className=""
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div></>)}
                                {/* 外观材质 - 仅对非自定义模型对象显示 */}
                                {!['cnc', 'custom_model'].includes(selectedObject.type) && !selectedObject.modelUrl && (
                                    <PropSection title="外观材质">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[11px] text-gray-400 w-16">颜色</label>
                                                <input
                                                    type="color"
                                                    value={selectedObject.color}
                                                    onChange={(e) => updateObject(selectedId, 'color', e.target.value)}
                                                    className="w-10 h-10 cursor-pointer border border-[#2a2a2a] bg-[#1a1a1a] rounded p-1"
                                                />
                                                <input
                                                    type="text"
                                                    value={selectedObject.color}
                                                    onChange={(e) => updateObject(selectedId, 'color', e.target.value)}
                                                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors font-mono uppercase"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-[11px] text-gray-400 w-16">透明度</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={selectedObject.opacity}
                                                    onChange={(e) => updateObject(selectedId, 'opacity', parseFloat(e.target.value))}
                                                    className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                                <span className="text-xs text-gray-400 w-12 text-right">{(selectedObject.opacity * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </PropSection>
                                )}
                                <div className="p-4 mt-4 border-t border-[#1a1a1a]"><button onClick={deleteSelected} className="w-full py-2 rounded-md bg-[#221111] text-red-500 border border-red-900/30 hover:bg-red-900/20 text-xs font-medium transition-all flex items-center justify-center gap-2"><Trash2 size={14} /> 删除对象</button></div>
                            </div>
                        ) : selectedIds.length > 1 ? (
                            <div className="pb-10">
                                <div className="p-4 border-b border-[#1a1a1a]">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-[#1a1a1a] border border-[#333] rounded flex items-center justify-center text-blue-500">
                                            <CopyCheck size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white">多选模式</div>
                                            <div className="text-[10px] text-gray-600 mt-0.5">已选中 {selectedIds.length} 个对象</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 批量替换模型 */}
                                {(() => {
                                    const replaceableTypes = ['waypoint', 'cube', 'cnc', 'column', 'door', 'custom_model'];
                                    const replaceableCount = selectedIds.filter(id => {
                                        const obj = objects.find(o => o.id === id);
                                        return obj && replaceableTypes.includes(obj.type);
                                    }).length;
                                    
                                    // 调试信息
                                    if (selectedIds.length > 0) {
                                        const selectedTypes = selectedIds.map(id => {
                                            const obj = objects.find(o => o.id === id);
                                            return obj ? obj.type : 'unknown';
                                        });
                                        console.log('🔍 批量替换检查:', {
                                            selectedIds: selectedIds.length,
                                            selectedTypes,
                                            replaceableCount,
                                            customAssetsCount: customAssets.length
                                        });
                                    }
                                    
                                    return replaceableCount > 0 && (
                                        <PropSection title={`批量替换模型 (${replaceableCount} 个对象)`}>
                                        <div className="bg-[#161616] p-3 rounded-lg border border-[#2a2a2a]">
                                            <div className="text-[10px] text-gray-500 mb-3 text-left">基础模型:</div>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <button onClick={() => batchReplaceWaypointModels('cnc')} className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400">
                                                    <Server size={14} />
                                                    <span className="text-[9px]">CNC</span>
                                                </button>
                                                <button onClick={() => batchReplaceWaypointModels('cube')} className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400">
                                                    <Box size={14} />
                                                    <span className="text-[9px]">占位方块</span>
                                                </button>
                                            </div>
                                            {customAssets.length > 0 ? (
                                                <>
                                                    <div className="text-[10px] text-gray-500 mb-2">自定义资产: ({customAssets.length})</div>
                                                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                                        {customAssets.map((asset, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => batchReplaceWaypointModels('custom_model', asset)}
                                                                className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] hover:border-blue-500 transition-all text-gray-400 hover:text-blue-400"
                                                                title={asset.label}
                                                            >
                                                                <Box size={12} />
                                                                <span className="text-[8px] truncate w-full text-center">{asset.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-[10px] text-gray-600 py-2 text-center">暂无自定义资产</div>
                                            )}
                                        </div>
                                    </PropSection>
                                    );
                                })()}

                                <div className="p-4 mt-4 border-t border-[#1a1a1a]">
                                    <button onClick={deleteSelected} className="w-full py-2 rounded-md bg-[#221111] text-red-500 border border-red-900/30 hover:bg-red-900/20 text-xs font-medium transition-all flex items-center justify-center gap-2">
                                        <Trash2 size={14} /> 删除选中对象 ({selectedIds.length})
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-white mb-4">场景属性</h3>

                                    {/* 场景信息 */}
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">场景名称</span>
                                            <span className="text-xs text-white">{floors.find(f => f.id === currentFloorId)?.name || '默认场景'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">对象总数</span>
                                            <span className="text-xs text-white">{objects.filter(o => !o.isBaseMap && o.type !== 'map_image').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">点位数量</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'waypoint').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">路径数量</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'path_line').length} 条</span>
                                        </div>
                                    </div>

                                    {/* 分隔线 */}
                                    <div className="border-t border-[#1a1a1a] my-6"></div>

                                    {/* 场景地图信息 */}
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">场景地图尺寸</span>
                                            <span className="text-xs text-white">
                                                {(() => {
                                                    // 优先查找 SLAM 底图，其次查找地图图片
                                                    const baseMap = objects.find(o => o.isBaseMap) ||
                                                        objects.find(o => o.type === 'map_image');
                                                    if (baseMap && baseMap.scale) {
                                                        const width = baseMap.scale[0].toFixed(1);
                                                        const height = baseMap.scale[2].toFixed(1);
                                                        return `${width}m × ${height}m`;
                                                    }
                                                    return '未加载地图';
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">场景楼层</span>
                                            <span className="text-xs text-white">共 {currentScene?.floorLevels?.length || 0} 层</span>
                                        </div>
                                    </div>

                                    {/* 分隔线 */}
                                    <div className="border-t border-[#1a1a1a] my-6"></div>

                                    {/* 场景统计 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">墙体</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'wall' || o.type === 'curved_wall').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">占位方块</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'cube').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">门</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'door').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">柱子</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'column').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">设备</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'cnc' || o.type === 'custom_model').length} 个</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">地面</span>
                                            <span className="text-xs text-white">{objects.filter(o => o.type === 'floor' || o.type === 'polygon_floor').length} 个</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};



export default App;
