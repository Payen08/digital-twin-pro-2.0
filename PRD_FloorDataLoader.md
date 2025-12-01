# 产品需求文档 (PRD): 楼层数据加载模块 (Floor Data Loader)

## 1. 概述 (Overview)

**模块名称**: Floor Data Loader (`floorDataLoader.js`)

**背景**:
在数字孪生 (Digital Twin) 应用中，需要加载来自 SLAM (Simultaneous Localization and Mapping) 系统的地图数据和点位信息。这些数据通常以特定的 JSON 格式存储，包含地图图片、分辨率、原点坐标以及路径点 (Waypoints) 的拓扑结构。

**目标**:
开发一个通用的数据加载模块，能够解析不同格式的 SLAM 导出文件，自动提取楼层信息，将坐标系转换为 3D 引擎 (Three.js) 标准，并生成可供前端渲染的地图和点位对象。

## 2. 功能需求 (Functional Requirements)

### 2.1 数据加载与格式识别
*   **支持格式**:
    1.  **完整拓扑格式 (Topology Format)**: 包含 `mapfileEntitys` (地图实体) 和 `graphTopologys` (图拓扑) 的复杂结构。通常用于包含多个楼层和详细路径信息的场景。
    2.  **简单地图格式 (Simple Format)**: 仅包含单个地图的基础信息 (`id`, `imageData`, `resolution` 等)。用于简单的单层地图展示。
*   **自动识别**: 模块需根据 JSON 内容自动判断文件格式并调用相应的解析逻辑。
*   **异步加载**: 提供 `loadFloorData` 异步接口，支持从指定路径 fetch JSON 文件。

### 2.2 楼层提取与识别 (Floor Extraction)
*   **多楼层支持**: 从完整拓扑数据中提取多个地图实体，每个实体视为一个潜在的楼层。
*   **楼层归属判断**:
    *   通过分析点位 (Pose) 的 `mapFileId` 属性，将点位关联到对应的地图。
    *   **启发式楼层命名**: 分析归属于某地图的所有点位名称，统计包含 "一楼/1F", "二楼/2F" 等关键词的频率，自动判定该地图所属的物理楼层 (如 "1", "2")。
*   **数据聚合**: 将地图信息与归属于该地图的点位聚合，生成统一的 `Floor` 对象。

### 2.3 坐标系转换 (Coordinate Transformation)
*   **源坐标系 (ROS)**: X轴向前, Y轴向左, Z轴向上 (通常 2D SLAM 输出为 X, Y 坐标，Yaw 角度)。
*   **目标坐标系 (Three.js)**: X轴向右, Y轴向上, Z轴向前。
*   **转换逻辑**:
    *   Position X (Three) = Position X (ROS)
    *   Position Z (Three) = -Position Y (ROS)
    *   Position Y (Three) = 固定高度 (如 0.1)
    *   Rotation Y (Three) = -Yaw (ROS)

### 2.4 地图可视化对象生成 (Base Map Generation)
*   **尺寸计算**: 根据 `resolution` (分辨率, 米/像素) 和图片像素宽高，计算地图在 3D 世界中的实际物理尺寸 (米)。
*   **位置校准**: 根据 `origin` (原点坐标) 和实际尺寸，计算地图平面的中心点位置，确保地图与世界坐标系原点对齐。
*   **材质处理**: 支持 Base64 编码字符串或 URL 路径作为地图纹理。

### 2.5 点位对象生成 (Waypoint Generation)
*   **属性映射**: 将原始 Pose 对象的 `uid`, `name`, `type` 等属性映射为前端使用的 Waypoint 对象。
*   **类型样式**: 根据 `poseType` 自动分配颜色：
    *   `ELEVATOR` (电梯): 红色 (#ff6b6b)
    *   `BAY` (停车位): 青色 (#4ecdc4)
    *   `NORMAL` (普通): 绿色 (#95e1d3)

## 3. 数据结构 (Data Structures)

### 3.1 输出数据模型 (Output Models)

#### Floor (楼层)
```javascript
{
  id: string,          // 楼层ID (如 "1", "2")
  name: string,        // 显示名称 (如 "1楼")
  description: string, // 描述信息
  baseMapId: string,   // 关联的底图ID
  mapFileId: string,   // 原始地图文件ID
  poses: Array,        // 原始点位数据数组
  objects: Array,      // (预留) 楼层包含的其他3D对象
  mapData: Object      // (可选) 简单模式下的原始地图数据
}
```

#### Waypoint (点位/3D对象)
```javascript
{
  id: string,          // 唯一标识 (如 "waypoint_123")
  type: "waypoint",    // 类型标识
  name: string,        // 点位名称
  position: [x, y, z], // Three.js 坐标 [x, y, z]
  rotation: [x, y, z], // 欧拉角 [0, rotationY, 0]
  scale: [x, y, z],    // 缩放比例
  color: string,       // 显示颜色 hex
  visible: boolean,    // 可见性
  poseData: Object     // 原始 Pose 数据引用
}
```

#### BaseMap (底图/3D对象)
```javascript
{
  id: string,          // 唯一标识 (如 "basemap_123")
  type: "map_image",   // 类型标识
  name: string,        // 地图名称
  position: [x, y, z], // 中心点坐标
  scale: [w, h, 1],    // 物理尺寸 [宽, 高, 1]
  imageData: string,   // 图片数据 (Base64/URL)
  isBaseMap: true,     // 底图标记
  mapData: Object      // 原始 Map 数据引用
}
```

## 4. 接口定义 (API Definitions)

### `loadFloorData(jsonPath)`
*   **描述**: 加载并解析指定路径的 JSON 文件。
*   **参数**: `jsonPath` (string, default: './1.5_地图_1763709378606.json')
*   **返回**: `Promise<{ floors, mapDataMap, rawData, format }>`

### `extractFloorsFromJSON(jsonData)`
*   **描述**: 从完整拓扑格式 JSON 中提取楼层数组。
*   **参数**: `jsonData` (Object)
*   **返回**: `Array<Floor>`

### `poseToWaypoint(pose, mapData)`
*   **描述**: 将单个 Pose 对象转换为 3D Waypoint 对象。
*   **参数**: `pose` (Object), `mapData` (Object)
*   **返回**: `Waypoint`

### `mapDataToBaseMap(mapData, imageData)`
*   **描述**: 将 Map 数据转换为 3D BaseMap 对象。
*   **参数**: `mapData` (Object), `imageData` (string)
*   **返回**: `BaseMap`

## 5. 假设与限制 (Assumptions & Limitations)
*   **假设**: 完整拓扑数据中，每个 `mapfileEntity` 对应一个物理楼层。
*   **假设**: 点位名称包含 "x楼" 或 "xF" 关键词，用于自动楼层归类。
*   **限制**: 目前仅硬编码支持 1-5 楼的关键词识别。
*   **限制**: 坐标转换仅针对特定的 ROS 坐标系定义 (Z-up vs Y-up)，如源数据坐标系变更需调整代码。
