# 批量操作功能集成指南

## 📦 已创建的文件

1. **`src/components/BatchOperations.jsx`** - 批量操作面板组件
2. **`src/components/BoxSelection.jsx`** - 框选功能组件
3. **`src/hooks/useBatchOperations.js`** - 批量操作 Hook
4. **`src/styles/BatchOperations.css`** - 批量操作样式

## 🎯 功能特性

- 🗑️ **批量删除** - 删除多个选中对象
- 📋 **批量复制** - 复制多个对象（偏移2个单位）
- 📦 **组合** - 将多个对象组合成 Group
- 📏 **批量缩放** - 统一缩放所有选中对象
- 🔄 **批量旋转** - 统一旋转（绕Y轴）
- 📐 **对齐** - 多种对齐方式（左、右、中、上、下）
- ↔️ **水平分布** - X轴均匀分布
- ↕️ **垂直分布** - Z轴均匀分布
- ❌ **取消选择** - 清空选择

## 🚀 集成步骤

### 步骤 1: 在 App.jsx 中导入组件

在 `App.jsx` 文件顶部添加导入：

\`\`\`javascript
import BoxSelection from './components/BoxSelection';
import BatchOperations from './components/BatchOperations';
import { useBatchOperations } from './hooks/useBatchOperations';
\`\`\`

### 步骤 2: 添加状态管理

在 `App` 组件中添加批量操作状态（约在第 1732 行之后）：

\`\`\`javascript
const App = () => {
    // ... 现有状态 ...
    
    // 添加批量操作状态
    const [batchSelectedObjects, setBatchSelectedObjects] = useState([]);
    const [sceneRef, setSceneRef] = useState(null);
    
    // ... 其他代码 ...
\`\`\`

### 步骤 3: 在 Canvas 内部获取 scene 引用

在 Canvas 内部添加一个组件来获取 Three.js scene 引用（约在第 4418 行之后）：

\`\`\`javascript
<Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
    {/* 获取 scene 引用 */}
    <SceneRefGetter setSceneRef={setSceneRef} />
    
    {/* 框选功能 - 添加在现有组件之后 */}
    <BoxSelectionIntegration 
        onSelectionChange={setBatchSelectedObjects}
    />
    
    {/* ... 现有的其他组件 ... */}
    <SelectionManager ... />
    <DragDropManager ... />
    {/* ... */}
</Canvas>
\`\`\`

### 步骤 4: 添加辅助组件

在 App.jsx 中添加这两个辅助组件（在 App 组件定义之前）：

\`\`\`javascript
// 获取 scene 引用的组件
function SceneRefGetter({ setSceneRef }) {
    const { scene } = useThree();
    
    useEffect(() => {
        setSceneRef(scene);
    }, [scene, setSceneRef]);
    
    return null;
}

// 框选集成组件
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
\`\`\`

### 步骤 5: 使用批量操作 Hook

在 App 组件中使用 Hook：

\`\`\`javascript
const App = () => {
    // ... 现有状态 ...
    const [sceneRef, setSceneRef] = useState(null);
    const [batchSelectedObjects, setBatchSelectedObjects] = useState([]);
    
    // 使用批量操作 Hook
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
    
    // ... 其他代码 ...
\`\`\`

### 步骤 6: 在 Canvas 外部渲染批量操作面板

在 App 组件的返回值中，Canvas 外部添加面板（约在第 5333 行之前）：

\`\`\`javascript
return (
    <div className="...">
        {/* ... 现有的 UI 元素 ... */}
        
        {/* Canvas */}
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
            {/* ... */}
        </Canvas>
        
        {/* 批量操作面板 - 添加在这里 */}
        <BatchOperations
            selectedObjects={selectedObjects}
            onClear={handleClear}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onGroup={handleGroup}
        />
        
        {/* ... 其他 UI 元素 ... */}
    </div>
);
\`\`\`

### 步骤 7: 导入样式

确保在 `src/main.jsx` 或 `src/App.jsx` 中导入样式：

\`\`\`javascript
import './styles/BatchOperations.css';
\`\`\`

## 📝 使用方法

1. **按住 Shift 键** + **拖动鼠标** 进行框选
2. 选中对象后，右上角会自动显示批量操作面板
3. 点击相应按钮执行批量操作

## ⚙️ 配置选项

### 自定义可选择对象

在 `BoxSelection.jsx` 中修改过滤逻辑：

\`\`\`javascript
const validSelected = allSelected.filter(obj => 
    obj.userData.selectable !== false &&
    !obj.userData.isGround &&
    obj.type !== 'GridHelper' &&
    obj.type !== 'TransformControlsGizmo' &&
    obj.type !== 'TransformControlsPlane' &&
    // 添加你自己的过滤条件
    obj.type !== 'your_custom_type'
);
\`\`\`

### 自定义复制偏移

在 `useBatchOperations.js` 中修改：

\`\`\`javascript
const handleDuplicate = useCallback((objects) => {
    const clones = objects.map(obj => {
        const clone = obj.clone();
        clone.position.x += 2; // 修改这里的偏移值
        clone.position.z += 1; // 可以添加 Z 轴偏移
        // ...
    });
    // ...
}, [scene]);
\`\`\`

## 🎨 样式自定义

修改 `src/styles/BatchOperations.css` 来自定义面板外观：

\`\`\`css
.batch-operations-panel {
    /* 修改位置 */
    top: 20px;
    right: 20px;
    
    /* 修改颜色 */
    background: rgba(30, 30, 30, 0.95);
    
    /* 修改大小 */
    min-width: 250px;
}
\`\`\`

## 🔧 故障排除

### 问题 1: 框选不工作

- 确保按住 **Shift 键**
- 检查 `BoxSelection` 组件是否在 Canvas 内部
- 检查浏览器控制台是否有错误

### 问题 2: 面板不显示

- 确保 CSS 文件已导入
- 检查 `selectedObjects.length > 0`
- 检查 z-index 是否被其他元素覆盖

### 问题 3: 删除/复制不工作

- 确保 `sceneRef` 不为 null
- 检查对象是否有正确的 geometry 和 material
- 查看浏览器控制台的错误信息

## 📚 API 参考

### BatchOperations 组件

\`\`\`typescript
interface BatchOperationsProps {
    selectedObjects: THREE.Object3D[];  // 选中的对象数组
    onClear: () => void;                // 清除选择回调
    onDelete: (objects: THREE.Object3D[]) => void;  // 删除回调
    onDuplicate: (objects: THREE.Object3D[]) => void;  // 复制回调
    onGroup: (objects: THREE.Object3D[]) => void;  // 组合回调
}
\`\`\`

### BoxSelection 组件

\`\`\`typescript
interface BoxSelectionProps {
    camera: THREE.Camera;               // Three.js 相机
    scene: THREE.Scene;                 // Three.js 场景
    renderer: THREE.WebGLRenderer;      // Three.js 渲染器
    onSelectionChange: (objects: THREE.Object3D[]) => void;  // 选择变化回调
}
\`\`\`

### useBatchOperations Hook

\`\`\`typescript
function useBatchOperations(scene: THREE.Scene) {
    return {
        selectedObjects: THREE.Object3D[];
        setSelectedObjects: (objects: THREE.Object3D[]) => void;
        handleDelete: (objects: THREE.Object3D[]) => void;
        handleDuplicate: (objects: THREE.Object3D[]) => void;
        handleGroup: (objects: THREE.Object3D[]) => void;
        handleClear: () => void;
    };
}
\`\`\`

## 🎉 完成！

现在你的应用已经具备完整的批量操作功能了！
\`\`\`
