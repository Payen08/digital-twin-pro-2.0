# 🧪 批量操作功能测试指南

批量操作功能已成功集成到你的 App.jsx 中！

## ✅ 已完成的集成

1. ✅ 导入了批量操作组件和样式
2. ✅ 添加了辅助组件（SceneRefGetter, BoxSelectionIntegration）
3. ✅ 添加了批量操作状态管理
4. ✅ 在 Canvas 内部添加了框选功能
5. ✅ 在 Canvas 外部添加了操作面板

## 🎯 如何测试

### 步骤 1: 启动应用
```bash
npm run dev
# 或
yarn dev
```

### 步骤 2: 添加一些对象
1. 在场景中添加几个对象（墙体、柱子、立方体等）
2. 确保场景中至少有 2-3 个可见对象

### 步骤 3: 测试框选
1. **按住 Shift 键**
2. **按住鼠标左键并拖动**，会出现蓝色虚线框
3. 释放鼠标，框选区域内的对象会被选中
4. 右上角会显示批量操作面板

### 步骤 4: 测试批量操作

#### 🗑️ 删除
- 点击"删除"按钮
- 确认对话框后，所有选中对象会被删除

#### 📋 复制
- 点击"复制"按钮
- 对象会被复制并在 X 轴偏移 2 个单位

#### 📦 组合
- 点击"组合"按钮
- 多个对象会被组合成一个 Group

#### 📏 缩放
- 点击"缩放"按钮
- 输入缩放比例（如 1.5）
- 所有对象会统一缩放

#### 🔄 旋转
- 点击"旋转"按钮
- 输入旋转角度（如 45）
- 所有对象会绕 Y 轴旋转

#### 📐 对齐
- 点击"对齐"按钮
- 输入对齐方式：left, center, right, top, bottom
- 对象会按指定方式对齐

#### ↔️ 水平分布
- 选中至少 3 个对象
- 点击"水平分布"按钮
- 对象会在 X 轴上均匀分布

#### ↕️ 垂直分布
- 选中至少 3 个对象
- 点击"垂直分布"按钮
- 对象会在 Z 轴上均匀分布

#### ❌ 取消选择
- 点击"取消选择"按钮
- 清空所有选择，面板消失

## 🐛 常见问题排查

### 问题 1: 按 Shift 拖动没有反应
**可能原因：**
- 对象没有设置 `userData.selectable = true`
- 对象被过滤掉了（如 GridHelper、TransformControls 等）

**解决方案：**
检查 `BoxSelection.jsx` 中的过滤逻辑：
```javascript
const validSelected = allSelected.filter(obj => 
    obj.userData.selectable !== false &&
    !obj.userData.isGround &&
    obj.type !== 'GridHelper' &&
    obj.type !== 'TransformControlsGizmo' &&
    obj.type !== 'TransformControlsPlane'
);
```

### 问题 2: 面板不显示
**可能原因：**
- CSS 文件没有加载
- 没有选中任何对象
- z-index 被其他元素覆盖

**解决方案：**
1. 检查浏览器控制台是否有 CSS 加载错误
2. 打开浏览器开发者工具，检查是否有 `.batch-operations-panel` 元素
3. 检查该元素的 z-index 是否为 1000

### 问题 3: 操作不生效
**可能原因：**
- `sceneRef` 为 null
- 对象没有正确的 geometry 或 material

**解决方案：**
1. 在浏览器控制台输入 `console.log(sceneRef)` 检查是否有值
2. 检查对象是否有 `geometry` 和 `material` 属性

### 问题 4: 框选框不可见
**可能原因：**
- SelectionHelper 的样式没有正确应用

**解决方案：**
检查 `BatchOperations.css` 中的 `#selectBox` 样式是否正确加载

## 📊 调试技巧

### 1. 查看选中的对象
打开浏览器控制台，框选后会输出：
```
🎯 开始框选
✅ 框选完成: 3 个对象
```

### 2. 查看操作日志
执行操作后会输出：
```
🗑️ 已删除 3 个对象
📋 已复制 3 个对象
📦 已组合 3 个对象
✅ 对齐完成: center
✅ 分布完成: x 轴
```

### 3. 检查 scene 引用
```javascript
// 在浏览器控制台
window.__scene = sceneRef;
console.log(window.__scene);
```

## 🎨 自定义配置

### 修改面板位置
编辑 `src/styles/BatchOperations.css`:
```css
.batch-operations-panel {
    top: 20px;    /* 修改这里 */
    right: 20px;  /* 修改这里 */
}
```

### 修改复制偏移
编辑 `src/hooks/useBatchOperations.js`:
```javascript
const handleDuplicate = useCallback((objects) => {
    const clones = objects.map(obj => {
        const clone = obj.clone();
        clone.position.x += 2;  // 修改 X 轴偏移
        clone.position.z += 1;  // 添加 Z 轴偏移
        // ...
    });
}, [scene]);
```

### 添加自定义操作
编辑 `src/components/BatchOperations.jsx`，添加新按钮：
```javascript
<button onClick={() => {
    // 你的自定义操作
    selectedObjects.forEach(obj => {
        // 例如：改变颜色
        if (obj.material) {
            obj.material.color.set('#ff0000');
        }
    });
}}>
    🎨 自定义操作
</button>
```

## ✨ 预期效果

1. **框选时**：
   - 出现蓝色虚线框
   - 控制台输出 "🎯 开始框选"

2. **选中后**：
   - 右上角显示操作面板
   - 显示 "已选择 X 个对象"
   - 控制台输出 "✅ 框选完成: X 个对象"

3. **执行操作后**：
   - 对象立即响应操作
   - 控制台输出相应日志
   - 面板保持显示（除非点击取消选择）

## 📝 注意事项

1. **Shift 键必须按住**：框选功能只在按住 Shift 键时激活
2. **对象可选性**：确保对象的 `userData.selectable` 不为 false
3. **性能考虑**：大量对象时，框选可能会有延迟
4. **操作不可撤销**：删除操作会立即生效，建议先测试复制功能

## 🎉 成功标志

如果你看到以下现象，说明集成成功：

- ✅ 按住 Shift 拖动时出现蓝色虚线框
- ✅ 释放鼠标后右上角显示操作面板
- ✅ 面板显示 "已选择 X 个对象"
- ✅ 点击操作按钮后对象响应正确
- ✅ 控制台输出相应的日志信息

---

**祝测试顺利！** 🚀

如果遇到问题，请查看：
- `BATCH_OPERATIONS_README.md` - 功能总览
- `BATCH_OPERATIONS_INTEGRATION.md` - 详细集成指南
