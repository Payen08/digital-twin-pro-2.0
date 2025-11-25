/**
 * 批量操作功能 - 快速集成代码片段
 * 
 * 复制以下代码片段到你的 App.jsx 中相应位置
 */

// ============================================
// 1. 在文件顶部添加导入 (约第 1 行)
// ============================================
import BoxSelection from './components/BoxSelection';
import BatchOperations from './components/BatchOperations';
import { useBatchOperations } from './hooks/useBatchOperations';
import './styles/BatchOperations.css';


// ============================================
// 2. 在 App 组件定义之前添加辅助组件 (约第 1730 行之前)
// ============================================

/**
 * 获取 scene 引用的组件
 * 必须放在 Canvas 内部
 */
function SceneRefGetter({ setSceneRef }) {
    const { scene } = useThree();
    
    useEffect(() => {
        setSceneRef(scene);
    }, [scene, setSceneRef]);
    
    return null;
}

/**
 * 框选集成组件
 * 必须放在 Canvas 内部
 */
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


// ============================================
// 3. 在 App 组件内部添加状态 (约第 1763 行之后)
// ============================================

const App = () => {
    // ... 现有状态 ...
    const [isPanelVisible, setIsPanelVisible] = useState(true);
    
    // 🆕 添加批量操作状态
    const [batchSelectedObjects, setBatchSelectedObjects] = useState([]);
    const [sceneRef, setSceneRef] = useState(null);
    
    // ... 其他代码 ...


// ============================================
// 4. 使用批量操作 Hook (约第 1800 行之后)
// ============================================

    // 🆕 使用批量操作 Hook
    const {
        selectedObjects: batchSelected,
        setSelectedObjects: setBatchSelected,
        handleDelete: handleBatchDelete,
        handleDuplicate: handleBatchDuplicate,
        handleGroup: handleBatchGroup,
        handleClear: handleBatchClear
    } = useBatchOperations(sceneRef);
    
    // 🆕 同步批量选择状态
    useEffect(() => {
        setBatchSelected(batchSelectedObjects);
    }, [batchSelectedObjects, setBatchSelected]);


// ============================================
// 5. 在 Canvas 内部添加组件 (约第 4418 行之后)
// ============================================

    return (
        <div className="...">
            {/* ... 现有 UI ... */}
            
            <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
                {/* 🆕 获取 scene 引用 */}
                <SceneRefGetter setSceneRef={setSceneRef} />
                
                {/* 🆕 框选功能 */}
                <BoxSelectionIntegration 
                    onSelectionChange={setBatchSelectedObjects}
                />
                
                {/* 现有组件 */}
                <SelectionManager ... />
                <DragDropManager ... />
                {/* ... 其他组件 ... */}
            </Canvas>


// ============================================
// 6. 在 Canvas 外部添加批量操作面板 (约第 5333 行之前)
// ============================================

            {/* 🆕 批量操作面板 */}
            <BatchOperations
                selectedObjects={batchSelected}
                onClear={handleBatchClear}
                onDelete={handleBatchDelete}
                onDuplicate={handleBatchDuplicate}
                onGroup={handleBatchGroup}
            />
            
        </div>
    );
};


// ============================================
// 完整示例：最小化集成版本
// ============================================

/*
import { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import BoxSelection from './components/BoxSelection';
import BatchOperations from './components/BatchOperations';
import { useBatchOperations } from './hooks/useBatchOperations';
import './styles/BatchOperations.css';

// 辅助组件
function SceneRefGetter({ setSceneRef }) {
    const { scene } = useThree();
    useEffect(() => { setSceneRef(scene); }, [scene, setSceneRef]);
    return null;
}

function BoxSelectionIntegration({ onSelectionChange }) {
    const { camera, scene, gl: renderer } = useThree();
    return <BoxSelection camera={camera} scene={scene} renderer={renderer} onSelectionChange={onSelectionChange} />;
}

// 主组件
function App() {
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
    
    useEffect(() => {
        setSelectedObjects(batchSelectedObjects);
    }, [batchSelectedObjects, setSelectedObjects]);
    
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas>
                <SceneRefGetter setSceneRef={setSceneRef} />
                <BoxSelectionIntegration onSelectionChange={setBatchSelectedObjects} />
                
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} />
                
                {/* 你的场景内容 *\/}
            </Canvas>
            
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

export default App;
*/


// ============================================
// 高级用法：与现有选择系统集成
// ============================================

/*
// 如果你想让批量选择与现有的 selectedIds 系统协同工作：

useEffect(() => {
    // 将批量选择的对象 ID 同步到现有的 selectedIds
    const ids = batchSelectedObjects.map(obj => obj.userData?.id || obj.name);
    setSelectedIds(ids);
}, [batchSelectedObjects]);

// 或者反向同步：当 selectedIds 改变时更新批量选择
useEffect(() => {
    if (sceneRef && selectedIds.length > 0) {
        const objects = [];
        sceneRef.traverse(child => {
            if (selectedIds.includes(child.userData?.id || child.name)) {
                objects.push(child);
            }
        });
        setBatchSelectedObjects(objects);
    }
}, [selectedIds, sceneRef]);
*/


// ============================================
// 自定义操作示例
// ============================================

/*
// 添加自定义批量操作按钮：

// 在 BatchOperations.jsx 中添加：
<button onClick={() => {
    // 批量改变颜色
    selectedObjects.forEach(obj => {
        if (obj.material) {
            obj.material.color.set('#ff0000');
        }
    });
}}>
    🎨 改变颜色
</button>

<button onClick={() => {
    // 批量隐藏
    selectedObjects.forEach(obj => {
        obj.visible = false;
    });
    onClear();
}}>
    👁️ 隐藏
</button>

<button onClick={() => {
    // 批量锁定
    selectedObjects.forEach(obj => {
        obj.userData.locked = true;
    });
}}>
    🔒 锁定
</button>
*/
