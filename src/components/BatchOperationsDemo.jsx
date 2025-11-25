/**
 * 批量操作功能演示
 * 这是一个独立的演示页面，展示批量操作功能的完整用法
 */

import React, { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import BoxSelection from './BoxSelection';
import BatchOperations from './BatchOperations';
import { useBatchOperations } from '../hooks/useBatchOperations';

// 辅助组件：获取 scene 引用
function SceneRefGetter({ setSceneRef }) {
    const { scene } = useThree();
    
    useEffect(() => {
        setSceneRef(scene);
    }, [scene, setSceneRef]);
    
    return null;
}

// 辅助组件：框选集成
function BoxSelectionIntegration({ onSelectionChange }) {
    const { camera, scene, gl: renderer } = useThree();
    
    return (
        <BoxSelection
            camera={camera}
            scene={scene}
            renderer={renderer}
            onSelectionChange={onSelectionChange}
        />
    );
}

// 演示用的立方体组件
function DemoBox({ position, color, id }) {
    return (
        <mesh 
            position={position} 
            name={id}
            userData={{ selectable: true, id }}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}

// 主演示组件
function BatchOperationsDemo() {
    const [sceneRef, setSceneRef] = useState(null);
    const [batchSelectedObjects, setBatchSelectedObjects] = useState([]);
    
    const {
        selectedObjects,
        setSelectedObjects,
        handleDelete,
        handleDuplicate,
        handleGroup,
        handleClear
    } = useBatchOperations(sceneRef);
    
    // 同步批量选择状态
    useEffect(() => {
        setSelectedObjects(batchSelectedObjects);
    }, [batchSelectedObjects, setSelectedObjects]);
    
    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* 说明文字 */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '20px',
                borderRadius: '8px',
                zIndex: 100,
                maxWidth: '300px'
            }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>批量操作演示</h2>
                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>使用方法：</strong>
                </p>
                <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '13px' }}>
                    <li>按住 <kbd>Shift</kbd> 键</li>
                    <li>拖动鼠标框选多个立方体</li>
                    <li>使用右上角面板进行批量操作</li>
                </ul>
                <p style={{ margin: '10px 0 5px 0', fontSize: '12px', color: '#aaa' }}>
                    当前选中: {selectedObjects.length} 个对象
                </p>
            </div>
            
            {/* 3D Canvas */}
            <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
                {/* 获取 scene 引用 */}
                <SceneRefGetter setSceneRef={setSceneRef} />
                
                {/* 框选功能 */}
                <BoxSelectionIntegration 
                    onSelectionChange={setBatchSelectedObjects}
                />
                
                {/* 光照 */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                
                {/* 地面 */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#2a2a2a" />
                </mesh>
                
                {/* 网格 */}
                <gridHelper args={[20, 20, '#444', '#333']} position={[0, -0.49, 0]} />
                
                {/* 演示用的立方体 - 3x3 网格 */}
                <DemoBox position={[-3, 0.5, -3]} color="#ff6b6b" id="box-1" />
                <DemoBox position={[0, 0.5, -3]} color="#4ecdc4" id="box-2" />
                <DemoBox position={[3, 0.5, -3]} color="#45b7d1" id="box-3" />
                
                <DemoBox position={[-3, 0.5, 0]} color="#f9ca24" id="box-4" />
                <DemoBox position={[0, 0.5, 0]} color="#6c5ce7" id="box-5" />
                <DemoBox position={[3, 0.5, 0]} color="#a29bfe" id="box-6" />
                
                <DemoBox position={[-3, 0.5, 3]} color="#fd79a8" id="box-7" />
                <DemoBox position={[0, 0.5, 3]} color="#fdcb6e" id="box-8" />
                <DemoBox position={[3, 0.5, 3]} color="#00b894" id="box-9" />
                
                {/* 轨道控制器 */}
                <OrbitControls 
                    makeDefault
                    enableDamping
                    dampingFactor={0.05}
                />
            </Canvas>
            
            {/* 批量操作面板 */}
            <BatchOperations
                selectedObjects={selectedObjects}
                onClear={handleClear}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onGroup={handleGroup}
            />
        </div>
    );
}

export default BatchOperationsDemo;
