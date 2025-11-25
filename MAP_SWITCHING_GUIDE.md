# 地图切换和楼层数据加载指南

## ✅ 已实现的功能

### 1. 多地图支持
- ✅ 支持两种 JSON 格式
  - 格式1: 完整拓扑数据（`1.5_地图_1763709378606.json`）
  - 格式2: 简单地图对象（`2025年11月24日10时14分31地图文件.json`）
- ✅ 地图选择器（在场景管理对话框中）
- ✅ 自动识别 JSON 格式

### 2. 楼层切换
- ✅ 点击楼层按钮切换
- ✅ 自动加载对应楼层的 SLAM 地图
- ✅ 自动加载对应楼层的点位数据
- ✅ 数据缓存机制

### 3. 图片格式支持
- ✅ base64 编码的 PNG 图片
- ✅ HTTP/HTTPS URL 图片
- ✅ data URL 格式

## 📁 可用的地图

### 地图1: 1.5楼层地图
- **文件**: `/1.5_地图_1763709378606.json`
- **格式**: 完整拓扑数据
- **包含**: 
  - 多个楼层（1楼、2楼）
  - 完整的点位数据
  - base64 编码的 SLAM 图片
- **点位数量**: 约 15-20 个

### 地图2: 新二楼地图
- **文件**: `/2025年11月24日10时14分31地图文件.json`
- **格式**: 简单地图对象
- **包含**:
  - 单个地图
  - URL 格式的 SLAM 图片
  - 无点位数据
- **图片**: `http://10.10.63.110:9000/moying-device-data/map/...`

## 🚀 使用方法

### 切换地图数据源

1. **打开场景管理**
   - 点击左侧底部的齿轮图标（⚙️）

2. **选择地图**
   - 在"选择地图数据源"下拉框中选择
   - 选项：
     - `1.5楼层地图 - 包含完整的点位和路径数据`
     - `新二楼地图 - xinerlou 地图`

3. **自动加载**
   - 选择后会自动加载新地图
   - 更新楼层列表
   - 加载 SLAM 底图和点位

### 切换楼层

1. **查看楼层列表**
   - 左侧底部显示所有可用楼层

2. **点击切换**
   - 点击要切换的楼层按钮
   - 当前楼层显示为蓝色

3. **自动加载**
   - 自动加载该楼层的 SLAM 地图
   - 自动加载该楼层的点位数据
   - 更新 3D 场景

## 🔄 数据加载流程

```
用户选择地图
    ↓
loadMapData(mapPath)
    ↓
检测 JSON 格式
    ├─→ 格式1: extractFloorsFromJSON()
    │   ├─→ 识别楼层
    │   ├─→ 分组点位
    │   └─→ 关联地图
    │
    └─→ 格式2: 创建单楼层对象
    ↓
缓存数据到 floorDataCache
    ↓
更新楼层列表
    ↓
加载第一个楼层
    ↓
loadFloorObjects(floor, mapDataMap)
    ├─→ 添加 SLAM 底图
    └─→ 添加点位对象
    ↓
更新 3D 场景
```

## 📊 控制台输出

### 成功加载
```
📥 加载地图数据: /1.5_地图_1763709378606.json
✅ 成功加载楼层数据: Array(2) 格式: topology
🗺️ 添加底图: SLAM地图 - 1.5
📍 添加点位: 15 个
✅ 已加载 1楼，包含 15 个点位
```

### 切换楼层
```
🔄 切换到楼层: 2楼
🗺️ 添加底图: SLAM地图 - 1.5
📍 添加点位: 12 个
✅ 已加载 2楼，包含 12 个点位
```

### 切换地图
```
📥 加载地图数据: /2025年11月24日10时14分31地图文件.json
✅ 成功加载楼层数据: Array(1) 格式: simple
🗺️ 添加底图: SLAM地图 - xinerlou
✅ 已加载 地图，包含 0 个点位
```

## 🎨 UI 界面

### 场景管理对话框

```
┌─────────────────────────────────┐
│ 场景管理                   ✕   │
├─────────────────────────────────┤
│ 选择地图数据源                  │
│ ┌─────────────────────────────┐ │
│ │ 1.5楼层地图 - 包含完整...  │ │
│ └─────────────────────────────┘ │
│                                 │
│ [+ 新增场景]                    │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 1楼          ✏️ 🗑️         │ │
│ │ 包含 15 个点位              │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 2楼          ✏️ 🗑️         │ │
│ │ 包含 12 个点位              │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│                        [关闭]   │
└─────────────────────────────────┘
```

### 左侧楼层面板

```
┌─────────────────────┐
│ 楼层          ⚙️    │
├─────────────────────┤
│ 🏢 1楼 (蓝色高亮)   │  ← 当前楼层
│ 🏢 2楼              │
└─────────────────────┘
```

## 🔧 技术实现

### 状态管理

```javascript
const [currentMapPath, setCurrentMapPath] = useState('/1.5_地图_1763709378606.json');
const [availableMaps] = useState(getAvailableMaps());
const [floorDataCache, setFloorDataCache] = useState({});
```

### 地图加载

```javascript
const loadMapData = useCallback(async (mapPath) => {
    const { floors, mapDataMap, format } = await loadFloorData(mapPath);
    
    // 缓存数据
    setFloorDataCache(prev => ({
        ...prev,
        [mapPath]: { floors, mapDataMap, format }
    }));
    
    // 更新楼层列表
    setFloors(floors);
    setCurrentFloorId(floors[0].id);
    
    // 加载第一个楼层
    await loadFloorObjects(floors[0], mapDataMap);
}, []);
```

### 楼层切换

```javascript
useEffect(() => {
    if (!currentFloorId || floors.length === 0) return;
    
    const floor = floors.find(f => f.id === currentFloorId);
    const cached = floorDataCache[currentMapPath];
    
    if (cached) {
        loadFloorObjects(floor, cached.mapDataMap);
    }
}, [currentFloorId]);
```

## 📝 JSON 格式说明

### 格式1: 完整拓扑数据

```json
{
  "mapfileEntitys": [
    {
      "record": {
        "name": "1.5",
        "width": 1757,
        "height": 2307,
        "resolution": 0.02,
        "origin": { "x": -28.117, "y": -30.217 }
      },
      "content": "iVBORw0KGgo..."  // base64 PNG
    }
  ],
  "graphTopologys": [
    {
      "poses": [
        {
          "name": "点位名称",
          "x": -8.608,
          "y": 9.441,
          "yaw": -1.571,
          "options": {
            "mapFileId": "uuid",
            "poseType": "NORMAL"
          }
        }
      ]
    }
  ]
}
```

### 格式2: 简单地图对象

```json
{
  "id": "d1dae417-e58c-4768-8006-528bf60536d3",
  "name": "xinerlou",
  "resolution": 0.02,
  "actualSize": {
    "width": 1706,
    "height": 1235
  },
  "origin": {
    "x": -40.646,
    "y": -6.887,
    "yaw": 0
  },
  "imageData": "http://10.10.63.110:9000/..."
}
```

## 🐛 故障排查

### 地图不显示

1. **检查控制台**
   - 查看是否有加载错误
   - 查看图片 URL 是否可访问

2. **检查 JSON 格式**
   - 确认 JSON 文件格式正确
   - 确认图片数据存在

3. **检查网络**
   - URL 图片需要网络访问
   - 检查 CORS 设置

### 楼层切换无效

1. **检查缓存**
   - 确认数据已缓存到 `floorDataCache`
   - 查看控制台的加载日志

2. **检查楼层ID**
   - 确认 `currentFloorId` 正确
   - 确认楼层在 `floors` 数组中存在

### 点位不显示

1. **检查点位数据**
   - 确认 JSON 中有 `poses` 数据
   - 确认点位有 `mapFileId` 关联

2. **检查坐标**
   - 点位坐标可能超出可视范围
   - 调整相机位置查看

## 📚 相关文件

- `src/utils/floorDataLoader.js` - 数据加载器
- `src/App.jsx` - 主应用逻辑
- `public/1.5_地图_1763709378606.json` - 地图1
- `public/2025年11月24日10时14分31地图文件.json` - 地图2

## 🎉 测试步骤

1. ✅ 启动项目：`npm run dev`
2. ✅ 查看默认地图加载
3. ✅ 打开场景管理对话框
4. ✅ 切换到另一个地图
5. ✅ 观察 SLAM 底图变化
6. ✅ 切换楼层
7. ✅ 观察点位数据变化
8. ✅ 查看控制台日志

---

**版本**: 1.1.0  
**最后更新**: 2025-11-24  
**新增功能**: 
- 多地图切换
- 楼层数据自动加载
- 数据缓存机制
