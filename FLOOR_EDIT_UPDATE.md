# 楼层编辑功能更新说明

## ✅ 更新内容

### 1. 编辑场景对话框增强
- ✅ "场景基础数据源"下拉框现在可以选择不同的地图 JSON
- ✅ 选择后自动加载对应的 SLAM 地图和点位数据
- ✅ 参考 `loadMapFromJSON` 的实现方式

### 2. SLAM 地图加载修复
- ✅ 修复了楼层切换时 SLAM 地图不显示的问题
- ✅ 使用与"导入工程 JSON"相同的加载逻辑
- ✅ 正确处理地图尺寸和位置

## 🎯 使用方法

### 方式1: 通过编辑场景对话框切换地图

1. **打开场景管理**
   - 点击左侧底部的齿轮图标（⚙️）

2. **编辑楼层**
   - 点击楼层卡片右上角的编辑图标（✏️）

3. **选择地图数据源**
   - 在"* 场景基础数据源"下拉框中选择：
     - `1.5楼层地图`
     - `新二楼地图`

4. **确定保存**
   - 点击"确定"按钮
   - 自动加载新地图的 SLAM 底图和点位

### 方式2: 通过场景管理对话框切换地图

1. **打开场景管理**
   - 点击左侧底部的齿轮图标（⚙️）

2. **选择地图数据源**
   - 在顶部"选择地图数据源"下拉框中选择
   - 自动加载新地图

## 🔄 数据加载流程

```
编辑场景对话框
    ↓
选择"场景基础数据源"
    ↓
点击"确定"
    ↓
检测地图路径是否变化
    ↓
调用 loadMapData(mapPath)
    ↓
加载 JSON 数据
    ↓
调用 loadFloorObjects(floor, mapDataMap)
    ↓
参考 loadMapFromJSON 的实现
    ├─→ 创建 map_image 对象
    │   ├─→ 计算地图尺寸
    │   ├─→ 设置位置 [0, -0.01, 0]
    │   ├─→ 设置缩放 [mapWidth, 1, mapHeight]
    │   └─→ 处理 base64 图片数据
    │
    └─→ 创建 waypoint 对象
        ├─→ 位置 [pose.x, 0.1, pose.y]
        ├─→ 旋转 [0, pose.yaw, 0]
        └─→ 根据类型设置颜色
    ↓
更新场景对象
    ↓
SLAM 地图显示 ✅
```

## 📊 关键代码更新

### 1. 编辑场景对话框

**之前**:
```jsx
<select className="w-full bg-[#1a1a1a] ...">
    <option>建筑主体地图</option>
</select>
```

**现在**:
```jsx
<select
    value={editingFloor.mapPath || currentMapPath}
    onChange={(e) => setEditingFloor({...editingFloor, mapPath: e.target.value})}
    className="w-full bg-[#1a1a1a] ..."
>
    {availableMaps.map(map => (
        <option key={map.id} value={map.path}>
            {map.name}
        </option>
    ))}
</select>
```

### 2. 确定按钮逻辑

**之前**:
```jsx
onClick={() => {
    setFloors(floors.map(f => f.id === editingFloor.id ? editingFloor : f));
    setEditingFloor(null);
}}
```

**现在**:
```jsx
onClick={async () => {
    // 更新楼层信息
    setFloors(floors.map(f => f.id === editingFloor.id ? editingFloor : f));
    
    // 如果选择了新的地图数据源，加载数据
    if (editingFloor.mapPath && editingFloor.mapPath !== currentMapPath) {
        console.log('🔄 切换地图数据源:', editingFloor.mapPath);
        setCurrentMapPath(editingFloor.mapPath);
        await loadMapData(editingFloor.mapPath);
    }
    
    setEditingFloor(null);
}}
```

### 3. loadFloorObjects 函数

**参考 loadMapFromJSON 的实现**:
```jsx
const loadFloorObjects = useCallback(async (floor, mapDataMap) => {
    const floorObjects = [];
    
    // 添加 SLAM 底图（使用与 loadMapFromJSON 相同的逻辑）
    if (floor.mapFileId && mapDataMap[floor.mapFileId]) {
        const mapData = mapDataMap[floor.mapFileId];
        const base64Image = mapData.imageData || mapData.content;
        
        // 计算地图尺寸
        const mapWidth = (mapData.width || mapData.actualSize?.width || 100) 
            * (mapData.resolution || 0.05);
        const mapHeight = (mapData.height || mapData.actualSize?.height || 100) 
            * (mapData.resolution || 0.05);
        
        const baseMapObj = {
            id: `map_${mapData.uid || mapData.id || Date.now()}`,
            type: 'map_image',
            name: mapData.name || mapData.alias || '地图底图',
            position: [0, -0.01, 0],  // 与 loadMapFromJSON 一致
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
    }
    
    // 添加点位（使用与 loadMapFromJSON 相同的逻辑）
    if (floor.poses && floor.poses.length > 0) {
        floor.poses.forEach(pose => {
            const poseObj = {
                id: `pose_${pose.uid}`,
                type: 'waypoint',
                name: pose.name || pose.alias,
                position: [pose.x, 0.1, pose.y],  // 与 loadMapFromJSON 一致
                rotation: [0, pose.yaw, 0],
                scale: [0.3, 0.3, 0.3],
                color: pose.parkable ? '#4CAF50' : (pose.dockable ? '#2196F3' : '#FFC107'),
                opacity: 1,
                visible: true,
                poseData: pose
            };
            floorObjects.push(poseObj);
        });
    }
    
    // 更新场景对象
    const baseFloor = initialObjects[0];
    const newObjects = [baseFloor, ...floorObjects];
    setObjects(newObjects);
}, []);
```

## 📝 控制台输出

### 切换地图数据源
```
🔄 切换地图数据源: /2025年11月24日10时14分31地图文件.json
📥 加载地图数据: /2025年11月24日10时14分31地图文件.json
✅ 成功加载楼层数据: Array(1) 格式: simple
🗺️ 添加底图: xinerlou 尺寸: 34.12 x 24.70
✅ 已加载 地图，包含 0 个点位
```

### 切换楼层
```
🔄 切换到楼层: 2楼
🗺️ 添加底图: 1.5 尺寸: 35.14 x 46.14
📍 添加点位: 12 个
✅ 已加载 2楼，包含 12 个点位
```

## 🎨 UI 界面

### 编辑场景对话框

```
┌─────────────────────────────────┐
│ 编辑场景                   ✕   │
├─────────────────────────────────┤
│ * 场景名称                      │
│ ┌─────────────────────────────┐ │
│ │ 1楼                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ * 场景基础数据源                │  ← 可选择
│ ┌─────────────────────────────┐ │
│ │ 1.5楼层地图            ▼   │ │  ← 下拉选择
│ └─────────────────────────────┘ │
│                                 │
│ * 底图选择                      │
│ ┌─────────────────────────────┐ │
│ │ 标准建筑底图                │ │
│ └─────────────────────────────┘ │
│                                 │
│ * 是否初始化地图关联设备        │
│ ┌─────────────────────────────┐ │
│ │ 是                          │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│                  [取消] [确定]  │
└─────────────────────────────────┘
```

## ✅ 问题解决

### 问题1: 楼层切换时 SLAM 地图不显示
**原因**: `loadFloorObjects` 使用了 `mapDataToBaseMap` 函数，其坐标计算与 `loadMapFromJSON` 不一致

**解决**: 
- 参考 `loadMapFromJSON` 的实现
- 使用相同的坐标系统：`position: [0, -0.01, 0]`
- 使用相同的尺寸计算方式
- 使用相同的对象结构

### 问题2: 地图数据源无法切换
**原因**: "场景基础数据源"下拉框是静态的，无法选择

**解决**:
- 添加 `value` 和 `onChange` 属性
- 使用 `availableMaps` 动态生成选项
- 在"确定"按钮中检测地图路径变化并加载

## 🔍 对比：两种加载方式

### loadMapFromJSON (导入工程 JSON)
```jsx
const baseMapObj = {
    id: `map_${record.uid}`,
    type: 'map_image',
    name: record.name || '地图底图',
    position: [0, -0.01, 0],
    rotation: [0, 0, 0],
    scale: [mapWidth, 1, mapHeight],
    color: '#ffffff',
    opacity: 0.8,
    visible: true,
    locked: true,
    isBaseMap: true,
    imageData: `data:image/png;base64,${base64Image}`,
    mapMetadata: record
};
```

### loadFloorObjects (楼层切换) - 现在一致 ✅
```jsx
const baseMapObj = {
    id: `map_${mapData.uid || mapData.id || Date.now()}`,
    type: 'map_image',
    name: mapData.name || mapData.alias || '地图底图',
    position: [0, -0.01, 0],  // ✅ 一致
    rotation: [0, 0, 0],
    scale: [mapWidth, 1, mapHeight],  // ✅ 一致
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
```

## 🧪 测试步骤

1. ✅ 启动项目：`npm run dev`
2. ✅ 默认加载第一个地图
3. ✅ 查看 SLAM 底图是否显示
4. ✅ 打开场景管理
5. ✅ 点击编辑楼层
6. ✅ 切换"场景基础数据源"
7. ✅ 点击"确定"
8. ✅ 观察 SLAM 地图是否更新
9. ✅ 观察点位是否更新
10. ✅ 查看控制台日志

## 📚 相关文件

- `src/App.jsx` - 主应用逻辑
  - `loadMapData()` - 加载地图数据
  - `loadFloorObjects()` - 加载楼层对象（已更新）
  - `loadMapFromJSON()` - 导入工程 JSON（参考实现）
  - 编辑场景对话框（已更新）

## 🎉 更新总结

1. ✅ 编辑场景对话框可以选择地图数据源
2. ✅ 选择后自动加载 SLAM 地图和点位
3. ✅ 使用与"导入工程 JSON"一致的加载逻辑
4. ✅ 修复了楼层切换时 SLAM 地图不显示的问题
5. ✅ 保持了代码的一致性和可维护性

---

**版本**: 1.2.0  
**最后更新**: 2025-11-24  
**修复问题**: 
- 楼层切换时 SLAM 地图不显示
- 地图数据源无法切换
