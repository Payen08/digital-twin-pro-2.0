# 合并策略管理器 - 完整实现指南

## 🎯 核心目标

实现智能的地图导入和路网更新系统，确保：
1. **无缝初始化** - 新用户导入 JSON 直接变成可用场景
2. **资产保护** - 更新路网时保护用户配置的 3D 模型
3. **数据完整性** - 完整解析 SLAM 底图、点位和路径

## 📋 业务逻辑流程

### 场景 A：默认场景下的首次创建/导入

#### 触发条件
- 用户打开编辑器（默认空场景）
- 点击"新增场景"或"导入地图 JSON"

#### 逻辑判断 1：当前画布是否"干净"？

**情况 1（干净）**：用户没做任何操作
```
动作：直接顶替
- 清空当前默认场景
- 加载 JSON 中的 SLAM 底图、点位和路径
- 创建新的正式场景
```

**情况 2（脏数据）**：用户已拖入装饰物
```
动作：弹窗询问
提示："检测到当前场景已存在编辑内容。您希望："

选项 A（保留并叠加）：
- 保留现有内容
- 将 JSON 地图作为底图垫在下面
- 点位叠加进来

选项 B（覆盖/顶替）：
- 清空当前所有内容
- 完全使用 JSON 数据初始化
```

### 场景 B：正式场景下的路网更新（错误防护）

#### 触发条件
- 用户在已有场景中
- 再次上传/更新路网 JSON

#### 逻辑判断 1：ID 匹配与绑定保护

系统遍历新 JSON 中的点位 (Poses)，检查 `sourceRefId` 匹配

**弹窗确认"更新策略"**

**选项 A（保留孪生绑定 - 推荐）**：
```javascript
// ID 匹配：仅更新位置
if (oldEntity.sourceRefId === newEntity.sourceRefId) {
    return {
        ...oldEntity,  // 保留 3D 模型、颜色、交互逻辑
        position: newEntity.position,  // 更新坐标
        rotation: newEntity.rotation   // 更新角度
    };
}

// ID 不匹配（新点位）：创建新的默认模型实体
// 旧点位在新 JSON 中消失：标记为"废弃"或自动删除
```

**选项 B（完全重置）**：
```javascript
// 删除所有现有实体
// 根据新 JSON 重新生成默认模型
// ⚠️ 原本配置的酷炫模型会丢失，需高亮警告
```

#### 逻辑判断 2：冲突检测 (Spatial Conflict)

检查：新导入的点位是否与现有的"纯虚拟节点"坐标重叠？

```javascript
if (distance < 0.5米) {
    // 生成"冲突报告"列表
    // 在 3D 场景中用红色线框标记冲突区域
    // 提示用户手动移动或删除
}
```

## 🔧 技术实现

### 1. 核心解析器 (`mapParser.js`)

```javascript
export const parseFullMapJson = (jsonInput) => {
    // 1. 解析底图 (SLAM Map)
    const baseMap = {
        id: 'base_slam_map',
        type: 'map_image',
        isBaseMap: true,
        position: [0, -0.01, 0],
        scale: [mapWidth, 1, mapHeight],
        imageData: base64Image
    };
    
    // 2. 解析点位 (Poses)
    const entities = poses.map(pose => ({
        id: uuidv4(),
        sourceRefId: String(pose.uid),  // 🔒 核心绑定键
        type: 'waypoint',
        position: [pose.x, 0.1, pose.y],
        visualConfig: {
            modelUrl: null,
            customColor: null
        }
    }));
    
    // 3. 解析路径 (Paths)
    const paths = topology.paths.map(path => ({
        id: uuidv4(),
        sourceRefId: String(path.uid),
        type: 'path_line',
        points: [start, end]
    }));
    
    return { baseMap, entities, paths, rawData };
};
```

### 2. 智能合并函数

```javascript
export const smartMergeEntities = (newEntities, oldObjects) => {
    return newEntities.map(newEnt => {
        const oldEnt = oldObjects.find(o => 
            o.sourceRefId === newEnt.sourceRefId
        );
        
        if (oldEnt) {
            // 命中！保留旧的视觉配置，更新位置
            return {
                ...oldEnt,
                position: newEnt.position,
                rotation: newEnt.rotation
            };
        } else {
            // 新增点位
            return newEnt;
        }
    });
};
```

### 3. 冲突检测函数

```javascript
export const checkSpatialConflicts = (newItems, oldItems, threshold = 0.5) => {
    const conflicts = [];
    const virtualItems = oldItems.filter(o => 
        !o.sourceRefId && !o.isBaseMap
    );
    
    newItems.forEach(newItem => {
        virtualItems.forEach(vItem => {
            const dist = calculateDistance(newItem, vItem);
            if (dist < threshold) {
                conflicts.push({ newItem, existingItem: vItem, distance: dist });
            }
        });
    });
    
    return conflicts;
};
```

### 4. 场景清洁检查

```javascript
export const isSceneClean = (objects) => {
    return objects.every(obj => 
        obj.type === 'floor' || 
        obj.isBaseMap || 
        obj.isDefaultInit
    );
};
```

## 🎨 UI 组件

### 1. 合并策略对话框

```
┌─────────────────────────────────────────┐
│ 🔄 更新路网数据                    ✕   │
├─────────────────────────────────────────┤
│ ⚠️ 检测到正在更新现有场景的路网数据    │
│ 新地图包含 15 个点位，8 条路径         │
│                                         │
│ 请选择更新策略：                        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ A  保留孪生绑定          [推荐]    │ │
│ │    • 保留已配置的 3D 模型          │ │
│ │    • 仅更新点位坐标和角度          │ │
│ │    • 自动处理新增/删除的点位       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ B  完全覆盖              [危险]    │ │
│ │    • 删除所有现有实体              │ │
│ │    • 丢失已配置的模型和样式        │ │
│ │    • ⚠️ 此操作不可撤销             │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                              [取消]     │
└─────────────────────────────────────────┘
```

### 2. 冲突检测报告（右上角浮窗）

```
┌─────────────────────────────────┐
│ ⚠️ 空间冲突报告            ✕   │
├─────────────────────────────────┤
│ 发现 3 处点位重叠，请手动调整   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 冲突 #1        距离: 0.3m   │ │
│ │ 📍 新点位: 充电桩A          │ │
│ │ 🔴 现有对象: 装饰柱         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 冲突 #2        距离: 0.4m   │ │
│ │ 📍 新点位: 停靠点B          │ │
│ │ 🔴 现有对象: 虚拟墙         │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│         [我知道了]              │
└─────────────────────────────────┘
```

## 📊 控制台输出示例

### 场景 A：首次创建（干净场景）

```
📦 解析完成: { baseMap: "1.5", entities: 15, paths: 8 }
✅ 场景干净，直接顶替
🗺️ 添加底图: 1.5 尺寸: 35.14 x 46.14
📍 添加点位: 15 个
🛤️ 添加路径: 8 条
✅ 场景创建成功
```

### 场景 B：路网更新（保留绑定）

```
📦 解析完成: { baseMap: "1.5", entities: 18, paths: 10 }
🔄 正式场景，启动智能合并
✅ 用户选择：保留绑定
🔗 保留绑定: 充电桩A (ID: 1001)
🔗 保留绑定: 停靠点B (ID: 1002)
➕ 新增点位: 电梯C (ID: 1018)
⚠️ 发现 2 处空间冲突
✅ 路网更新成功（保留绑定）
```

## ✅ 测试清单

### 场景 A 测试

- [ ] 空场景导入 JSON → 直接顶替
- [ ] 有装饰物导入 JSON → 弹窗询问
- [ ] 选择"保留并叠加" → 装饰物保留
- [ ] 选择"覆盖" → 装饰物清空
- [ ] SLAM 底图正确显示
- [ ] 点位正确显示
- [ ] 路径正确显示

### 场景 B 测试

- [ ] 正式场景更新路网 → 弹出合并对话框
- [ ] 选择"保留绑定" → 旧模型保留，位置更新
- [ ] 选择"完全覆盖" → 弹出二次确认
- [ ] 冲突检测正常工作
- [ ] 冲突报告正确显示
- [ ] 新增点位正确创建
- [ ] 废弃点位正确处理

### 数据完整性测试

- [ ] SLAM 底图完整加载
- [ ] 所有点位都加载
- [ ] 所有路径都加载
- [ ] 坐标转换正确
- [ ] sourceRefId 正确绑定

## 🎉 核心优势

1. **无缝初始化** ✅
   - 新用户导入 JSON 直接变成可用场景
   - 不需要手动删删减减

2. **资产保护** ✅
   - 通过 `sourceRefId` 锚定
   - 保护用户配置的 3D 模型
   - 路网坐标微调不会重置模型

3. **数据完整性** ✅
   - 同时处理 Base64 底图、Pose 点位和 Path 路径
   - 确保"所见即所得"

4. **错误防护** ✅
   - 冲突检测和报告
   - 二次确认危险操作
   - 清晰的用户提示

## 📝 使用流程

### 首次创建场景

```
1. 打开编辑器（默认场景）
2. 点击"默认场景"或"新增场景"
3. 选择地图 JSON 文件
4. 点击"确定"
   ↓
   如果场景干净 → 直接加载
   如果有内容 → 询问是否保留
   ↓
5. 场景创建成功 ✅
```

### 更新路网数据

```
1. 在已有场景中
2. 点击"新增场景"选择新的 JSON
3. 系统检测到是路网更新
   ↓
4. 弹出合并策略对话框
   ↓
   选项 A：保留绑定（推荐）
   - 保留模型配置
   - 更新坐标
   
   选项 B：完全覆盖（危险）
   - 二次确认
   - 全部重置
   ↓
5. 冲突检测
   - 如有冲突 → 显示报告
   - 无冲突 → 直接完成
   ↓
6. 更新成功 ✅
```

## 🔗 相关文件

- `src/utils/mapParser.js` - 核心解析器
- `src/App.jsx` - 合并策略管理器集成
- `MERGE_STRATEGY_GUIDE.md` - 本文档

---

**版本**: 2.0.0  
**最后更新**: 2025-11-24  
**实现状态**: ✅ 完成
