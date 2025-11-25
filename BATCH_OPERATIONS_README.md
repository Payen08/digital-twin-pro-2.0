# 🎯 批量操作功能

一个完整的批量选择和操作系统，支持框选、批量编辑、对齐、分布等功能。

## 📦 已创建的文件

```
src/
├── components/
│   ├── BatchOperations.jsx          # 批量操作面板组件
│   ├── BoxSelection.jsx             # 框选功能组件
│   ├── BatchOperationsDemo.jsx      # 演示页面（可选）
│   └── BatchOperationsIntegration.jsx  # 集成示例（可选）
├── hooks/
│   └── useBatchOperations.js        # 批量操作 Hook
└── styles/
    └── BatchOperations.css          # 批量操作样式

根目录/
├── BATCH_OPERATIONS_INTEGRATION.md  # 详细集成指南
├── INTEGRATION_CODE_SNIPPETS.md     # 快速集成代码片段
└── BATCH_OPERATIONS_README.md       # 本文件
```

## ✨ 功能列表

| 功能 | 说明 | 快捷键 |
|------|------|--------|
| 🗑️ 批量删除 | 删除所有选中的对象 | - |
| 📋 批量复制 | 复制对象并偏移2个单位 | - |
| 📦 组合 | 将多个对象组合成 Group | - |
| 📏 批量缩放 | 统一缩放所有对象 | - |
| 🔄 批量旋转 | 绕Y轴统一旋转 | - |
| 📐 对齐 | 左/右/中/上/下对齐 | - |
| ↔️ 水平分布 | X轴均匀分布（需≥3个对象） | - |
| ↕️ 垂直分布 | Z轴均匀分布（需≥3个对象） | - |
| ❌ 取消选择 | 清空所有选择 | - |
| 🖱️ 框选 | 拖动鼠标框选多个对象 | Shift + 拖动 |

## 🚀 快速开始

### 1. 查看演示

如果你想先看看效果，可以运行演示页面：

```jsx
// 在你的路由中添加
import BatchOperationsDemo from './components/BatchOperationsDemo';

// 或者临时替换 App.jsx 的导出
export { default } from './components/BatchOperationsDemo';
```

### 2. 集成到现有项目

查看详细的集成指南：

- **详细文档**: `BATCH_OPERATIONS_INTEGRATION.md`
- **代码片段**: `INTEGRATION_CODE_SNIPPETS.md`

### 3. 最小化集成（3步）

#### 步骤 1: 导入组件

```javascript
import BoxSelection from './components/BoxSelection';
import BatchOperations from './components/BatchOperations';
import { useBatchOperations } from './hooks/useBatchOperations';
import './styles/BatchOperations.css';
```

#### 步骤 2: 添加到 Canvas 内部

```javascript
<Canvas>
    {/* 添加这两个辅助组件 */}
    <SceneRefGetter setSceneRef={setSceneRef} />
    <BoxSelectionIntegration onSelectionChange={setBatchSelectedObjects} />
    
    {/* 你的其他组件 */}
</Canvas>
```

#### 步骤 3: 添加操作面板

```javascript
<BatchOperations
    selectedObjects={selectedObjects}
    onClear={handleClear}
    onDelete={handleDelete}
    onDuplicate={handleDuplicate}
    onGroup={handleGroup}
/>
```

## 📖 使用方法

### 基本操作

1. **框选对象**
   - 按住 `Shift` 键
   - 按住鼠标左键并拖动
   - 释放鼠标完成选择

2. **执行操作**
   - 选中对象后，右上角会显示操作面板
   - 点击相应按钮执行操作

### 高级功能

#### 对齐操作

支持以下对齐方式：
- `left` - 左对齐
- `right` - 右对齐
- `center` - 水平居中
- `top` - 顶部对齐
- `bottom` - 底部对齐
- `middle` - 垂直居中

#### 分布操作

- **水平分布**: 在X轴上均匀分布对象（需要至少3个对象）
- **垂直分布**: 在Z轴上均匀分布对象（需要至少3个对象）

## ⚙️ 配置

### 自定义可选择对象

编辑 `src/components/BoxSelection.jsx`:

```javascript
const validSelected = allSelected.filter(obj => 
    obj.userData.selectable !== false &&
    !obj.userData.isGround &&
    obj.type !== 'GridHelper' &&
    // 添加你的过滤条件
    obj.type !== 'YourCustomType'
);
```

### 自定义复制偏移

编辑 `src/hooks/useBatchOperations.js`:

```javascript
const handleDuplicate = useCallback((objects) => {
    const clones = objects.map(obj => {
        const clone = obj.clone();
        clone.position.x += 2;  // 修改X轴偏移
        clone.position.z += 1;  // 添加Z轴偏移
        // ...
    });
}, [scene]);
```

### 自定义样式

编辑 `src/styles/BatchOperations.css`:

```css
.batch-operations-panel {
    top: 20px;        /* 修改位置 */
    right: 20px;
    min-width: 250px; /* 修改大小 */
    background: rgba(30, 30, 30, 0.95); /* 修改背景 */
}
```

## 🎨 界面预览

```
┌─────────────────────────────────────────────┐
│  已选择 3 个对象                              │
├─────────────────────────────────────────────┤
│  🗑️ 删除    │  📋 复制                       │
│  📦 组合    │  📏 缩放                       │
│  🔄 旋转    │  📐 对齐                       │
│  ↔️ 水平分布 │  ↕️ 垂直分布                   │
│  ❌ 取消选择                                 │
└─────────────────────────────────────────────┘
```

## 🔧 API 参考

### BatchOperations 组件

```typescript
interface BatchOperationsProps {
    selectedObjects: THREE.Object3D[];
    onClear: () => void;
    onDelete: (objects: THREE.Object3D[]) => void;
    onDuplicate: (objects: THREE.Object3D[]) => void;
    onGroup: (objects: THREE.Object3D[]) => void;
}
```

### BoxSelection 组件

```typescript
interface BoxSelectionProps {
    camera: THREE.Camera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    onSelectionChange: (objects: THREE.Object3D[]) => void;
}
```

### useBatchOperations Hook

```typescript
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
```

## 🐛 故障排除

### 框选不工作

- ✅ 确保按住 **Shift 键**
- ✅ 检查 `BoxSelection` 是否在 Canvas 内部
- ✅ 检查浏览器控制台错误

### 面板不显示

- ✅ 确保导入了 CSS 文件
- ✅ 检查 `selectedObjects.length > 0`
- ✅ 检查 z-index 层级

### 操作不生效

- ✅ 确保 `sceneRef` 不为 null
- ✅ 检查对象的 geometry 和 material
- ✅ 查看控制台错误信息

## 📝 注意事项

1. **性能优化**
   - 大量对象时，框选可能会有延迟
   - 建议对复杂场景进行分层管理

2. **兼容性**
   - 需要 Three.js r140+
   - 需要 @react-three/fiber v8+
   - 需要 @react-three/drei v9+

3. **对象要求**
   - 对象需要有 `userData.selectable` 属性（或不设置，默认可选）
   - 对象需要在 scene 树中可遍历

## 🎯 下一步

- [ ] 添加撤销/重做支持
- [ ] 添加批量属性编辑
- [ ] 添加保存/加载选择集
- [ ] 添加选择历史记录
- [ ] 添加快捷键支持

## 📚 相关文档

- [Three.js 官方文档](https://threejs.org/docs/)
- [React Three Fiber 文档](https://docs.pmnd.rs/react-three-fiber/)
- [SelectionBox 文档](https://threejs.org/docs/#examples/en/interactive/SelectionBox)

## 💡 提示

- 使用 `Shift + 拖动` 进行框选
- 框选时会显示蓝色虚线框
- 选中的对象会在面板中显示数量
- 所有操作都会在控制台输出日志

## 🤝 贡献

如果你有任何改进建议或发现了 bug，欢迎提出！

---

**祝你使用愉快！** 🎉
