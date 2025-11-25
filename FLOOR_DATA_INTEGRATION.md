# 楼层数据集成说明

## 概述

已成功集成 `1.5_地图_1763709378606.json` 数据源，实现了 SLAM 地图和点位数据的自动加载。

## 数据源结构

### JSON 文件结构
```json
{
  "mapfileEntitys": [
    {
      "record": {
        "name": "1.5",
        "uid": 524776594,
        "origin": { "x": -28.117, "y": -30.217 },
        "resolution": 0.02,
        "width": 1757,
        "height": 2307,
        "ownerGraphName": "1.5yangshou"
      },
      "content": "iVBORw0KGgo..." // base64 编码的 PNG 图片
    }
  ],
  "graphTopologys": [
    {
      "poses": [
        {
          "name": "二楼货梯过渡",
          "x": -8.608,
          "y": 9.441,
          "yaw": -1.571,
          "options": {
            "mapFileId": "b42e213c-d256-412c-a16e-2e3d274dda8b",
            "poseType": "NORMAL"
          }
        }
      ]
    }
  ]
}
```

## 实现功能

### 1. 数据加载器 (`src/utils/floorDataLoader.js`)

#### 核心函数

**`loadFloorData(jsonPath)`**
- 加载 JSON 文件
- 解析地图和点位数据
- 返回楼层列表和地图数据映射

**`extractFloorsFromJSON(jsonData)`**
- 从 JSON 中提取楼层信息
- 通过点位名称识别楼层（"一楼"、"二楼"等）
- 按 `mapFileId` 分组点位

**`poseToWaypoint(pose, mapData)`**
- 将 ROS 点位数据转换为 Three.js 3D 对象
- 坐标系转换：ROS (x前, y左, z上) → Three.js (x右, y上, z前)
- 根据点位类型设置颜色

**`mapDataToBaseMap(mapData, imageData)`**
- 将 SLAM 地图转换为底图对象
- 计算实际尺寸和位置
- 处理 base64 图片数据

### 2. 坐标系转换

#### ROS → Three.js
```javascript
// 位置转换
const x = pose.x;           // ROS x → Three.js x
const z = -pose.y;          // ROS y → Three.js -z
const y = 0.1;              // 点位高度

// 旋转转换
const rotationY = -pose.yaw; // ROS yaw → Three.js -rotationY
```

### 3. 点位类型和颜色

| 点位类型 | 颜色 | 说明 |
|---------|------|------|
| ELEVATOR | #ff6b6b (红色) | 电梯点位 |
| BAY | #4ecdc4 (青色) | 停车位 |
| NORMAL | #95e1d3 (绿色) | 普通点位 |

### 4. 楼层识别逻辑

通过点位名称中的关键词识别楼层：
- 1楼：`一楼`, `1楼`, `1F`
- 2楼：`二楼`, `2楼`, `2F`
- 3楼：`三楼`, `3楼`, `3F`
- ...

统计每个 `mapFileId` 下各楼层关键词出现次数，选择最多的作为该地图的楼层。

## 自动加载流程

### 启动时自动加载

1. **组件挂载**：App 组件初始化
2. **加载 JSON**：从 `/1.5_地图_1763709378606.json` 加载数据
3. **解析数据**：提取楼层、地图、点位信息
4. **更新状态**：
   - 设置楼层列表 (`setFloors`)
   - 设置当前楼层 (`setCurrentFloorId`)
5. **加载场景**：
   - 添加 SLAM 底图
   - 添加所有点位
   - 更新场景对象列表

### 控制台输出

成功加载时会看到：
```
✅ 成功加载楼层数据: [{id: '1', name: '1楼', ...}, ...]
✅ 已加载 1楼，包含 15 个点位
```

失败时会看到：
```
❌ 加载楼层数据失败: Error: ...
```

## 数据文件位置

```
digital-twin-pro/
├── public/
│   └── 1.5_地图_1763709378606.json  ← JSON 数据文件
├── src/
│   ├── utils/
│   │   └── floorDataLoader.js       ← 数据加载器
│   └── App.jsx                      ← 主应用（集成加载逻辑）
```

## 使用方法

### 查看加载的数据

1. 启动项目：`npm run dev`
2. 打开浏览器控制台（F12）
3. 查看加载日志
4. 在左侧面板底部查看楼层列表

### 切换楼层

1. 点击左侧底部的楼层按钮
2. 场景会切换到对应楼层（当前版本所有对象在同一场景）

### 查看点位信息

1. 点击场景中的点位（绿色/红色/青色球体）
2. 在右侧属性面板查看点位详细信息
3. 可以编辑点位的位置、旋转等属性

## 数据结构

### 楼层对象
```javascript
{
  id: '1',                    // 楼层ID
  name: '1楼',                // 楼层名称
  description: '包含 15 个点位', // 描述
  baseMapId: 'map_id',        // 底图ID
  mapFileId: 'uuid',          // 地图文件ID
  poses: [...],               // 点位数组
  objects: []                 // 3D对象数组
}
```

### 点位对象
```javascript
{
  id: 'waypoint_807441992',
  type: 'waypoint',
  name: '二楼货梯过渡',
  position: [-8.608, 0.1, -9.441],
  rotation: [0, 1.571, 0],
  scale: [0.3, 0.3, 0.3],
  color: '#95e1d3',
  visible: true,
  locked: false,
  poseData: {...}  // 原始点位数据
}
```

### 底图对象
```javascript
{
  id: 'basemap_524776594',
  type: 'map_image',
  name: 'SLAM地图 - 1.5',
  position: [centerX, 0.01, centerZ],
  rotation: [-Math.PI/2, 0, 0],
  scale: [realWidth, realHeight, 1],
  imageData: 'data:image/png;base64,...',
  visible: true,
  locked: true,
  isBaseMap: true,
  mapData: {...}  // 原始地图数据
}
```

## 已知限制

1. **楼层对象隔离**：当前所有楼层的对象都在同一场景中，切换楼层不会隐藏其他楼层的对象
2. **地图ID映射**：需要手动维护 `mapFileId` 到楼层的映射关系
3. **坐标精度**：坐标转换可能存在精度损失
4. **图片加载**：大尺寸 base64 图片可能影响性能

## 后续优化建议

### 高优先级
1. **楼层对象隔离**
   ```javascript
   // 切换楼层时只显示当前楼层的对象
   const visibleObjects = objects.filter(obj => 
     obj.floorId === currentFloorId || obj.isBaseMap
   );
   ```

2. **动态加载**
   ```javascript
   // 切换楼层时动态加载对应的地图和点位
   const loadFloor = async (floorId) => {
     const floor = floors.find(f => f.id === floorId);
     // 加载地图和点位...
   };
   ```

### 中优先级
3. **图片缓存**
   - 使用 IndexedDB 缓存 base64 图片
   - 避免重复解码

4. **坐标校准**
   - 提供坐标校准工具
   - 支持手动调整原点和比例

### 低优先级
5. **路径可视化**
   - 从 JSON 的 `paths` 数据加载路径
   - 在场景中绘制路径线

6. **设备关联**
   - 支持点位关联设备信息
   - 显示设备状态

## 调试技巧

### 查看加载的数据
```javascript
// 在浏览器控制台执行
console.log('楼层列表:', floors);
console.log('当前楼层:', currentFloorId);
console.log('场景对象:', objects);
```

### 检查点位坐标
```javascript
// 查看点位的原始坐标和转换后坐标
const waypoint = objects.find(o => o.type === 'waypoint');
console.log('原始坐标:', waypoint.poseData);
console.log('Three.js坐标:', waypoint.position);
```

### 验证地图加载
```javascript
// 查看底图对象
const baseMap = objects.find(o => o.type === 'map_image');
console.log('底图:', baseMap);
console.log('图片数据长度:', baseMap.imageData.length);
```

## 测试清单

- [ ] JSON 文件成功加载
- [ ] 楼层列表正确显示
- [ ] SLAM 底图正确渲染
- [ ] 点位位置正确
- [ ] 点位颜色符合类型
- [ ] 点位可以选中和编辑
- [ ] 楼层切换功能正常
- [ ] 控制台无错误信息

## 技术支持

如遇问题，请检查：
1. JSON 文件是否在 `public/` 目录
2. 浏览器控制台的错误信息
3. 网络请求是否成功（Network 标签）
4. 点位坐标是否合理

---

**版本**: 1.0.0  
**最后更新**: 2025-11-24  
**相关文件**: 
- `src/utils/floorDataLoader.js`
- `src/App.jsx`
- `public/1.5_地图_1763709378606.json`
