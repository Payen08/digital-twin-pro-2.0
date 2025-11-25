# 吸附到路径功能实现指南

## 🎯 问题描述

**现象**: 鼠标光标只能吸附到网格点（Grid），无法吸附到地图上的路径（黑线）

**原因**: 底图上的黑线只是图片上的像素，系统不知道那是"路"

**解决方案**: 
1. 利用解析出来的矢量数据（Points & Paths）进行数学计算，实现点线双重吸附
2. 提供自由模式（按住 Alt/Option 键），完全禁用吸附，指哪打哪

---

## 🎮 操作方式

### 三种模式

| 模式 | 触发方式 | 光标颜色 | 适用场景 |
|------|---------|---------|---------|
| 🔵 **网格吸附** | 默认 | 蓝色 | 绘制规整的墙体、对齐网格 |
| 🟢 **点/线吸附** | 靠近路径/设备 | 绿色 | 连接设备、沿路径绘制 |
| 🟠 **自由模式** | 按住 Alt/Option | 橙色 | 描图、精确点击底图上的任意位置 |

### 快捷键

- **Alt (Option)**: 按住启用自由模式，松开恢复吸附
- **Enter**: 完成绘制
- **Esc**: 取消绘制

---

## 📊 吸附逻辑架构

### 吸附优先级

```
鼠标移动
    ↓
检测 Alt 键？
    ├─ 是 → 自由模式（直接使用真实坐标）🟠
    └─ 否 → 吸附模式
        ↓
    1. 射线检测 → 获取地面原始位置
        ↓
    2. 点吸附检测 → 吸附到设备/路径端点 🟢
        ↓ (未吸附)
    3. 线吸附检测 → 吸附到路径线段 🟢
        ↓ (未吸附)
    4. 网格吸附 → 吸附到网格交叉点（保底）🔵
        ↓
    5. 更新光标位置 + 视觉反馈
```

---

## 🔧 核心实现

### 1. 点吸附（Snap to Point）

**适用场景**:
- 连接到设备位置
- 连接到路径转折点
- 连接到墙体端点

**算法**:
```javascript
// 遍历所有对象的点位
objects.forEach(obj => {
    const pointsToCheck = [];
    
    // 设备位置
    if (obj.position) {
        pointsToCheck.push(new THREE.Vector3(obj.position[0], 0, obj.position[2]));
    }
    
    // 路径/墙体顶点
    if (obj.points) {
        obj.points.forEach(p => {
            const worldX = p.x + (obj.position ? obj.position[0] : 0);
            const worldZ = p.z + (obj.position ? obj.position[2] : 0);
            pointsToCheck.push(new THREE.Vector3(worldX, 0, worldZ));
        });
    }
    
    // 计算距离
    pointsToCheck.forEach(pt => {
        const dist = target.distanceTo(pt);
        if (dist < minDistance) {
            minDistance = dist;
            bestPos = { x: pt.x, y: 0, z: pt.z };
            snapped = true;
        }
    });
});
```

---

### 2. 线吸附（Snap to Edge）

**适用场景**:
- 沿路径滑动
- 在路径中间引出新线
- 沿墙体边缘绘制

**算法**:
```javascript
// 遍历所有对象的线段
if (obj.points && obj.points.length >= 2) {
    for (let i = 0; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i];
        const p2 = obj.points[i + 1];
        
        // 转换为世界坐标
        const v1 = new THREE.Vector3(
            p1.x + (obj.position ? obj.position[0] : 0), 
            0, 
            p1.z + (obj.position ? obj.position[2] : 0)
        );
        const v2 = new THREE.Vector3(
            p2.x + (obj.position ? obj.position[0] : 0), 
            0, 
            p2.z + (obj.position ? obj.position[2] : 0)
        );
        
        // 使用 Three.js Line3 计算最近点
        const lineSegment = new THREE.Line3(v1, v2);
        const closestPoint = new THREE.Vector3();
        lineSegment.closestPointToPoint(target, true, closestPoint);
        
        // 计算距离
        const dist = target.distanceTo(closestPoint);
        if (dist < minDistance) {
            minDistance = dist;
            bestPos = { x: closestPoint.x, y: 0, z: closestPoint.z };
            snapped = true;
        }
    }
}
```

**关键 API**: `THREE.Line3.closestPointToPoint(point, clampToLine, target)`
- `point`: 鼠标位置
- `clampToLine`: true = 限制在线段两端之间
- `target`: 输出最近点

---

### 3. 网格吸附（Snap to Grid）

**保底逻辑**:
```javascript
let bestPos = { 
    x: snapToGrid(target.x), 
    y: 0, 
    z: snapToGrid(target.z) 
};
```

---

## 🎨 视觉反馈

### 光标颜色变化

```javascript
<mesh position={[mousePos.x, 0.05, mousePos.z]}>
    <ringGeometry args={[0.1, 0.15, 32]} />
    <meshBasicMaterial 
        color={isFreeMode ? "#f97316" : (isSnapped ? "#4ade80" : "#3b82f6")}
        depthTest={false} 
        transparent 
        opacity={0.8}
    />
</mesh>
```

**效果**:
- 🔵 蓝色：网格吸附（默认）
- 🟢 绿色：点/线吸附（已锁定）
- 🟠 橙色：自由模式（按住 Alt/Option）

---

## 📐 参数配置

### 吸附半径

```javascript
const SNAP_THRESHOLD = 0.5; // 0.5米
```

**建议值**:
- 精细操作：`0.3` - `0.5`
- 粗略操作：`0.5` - `1.0`
- 大场景：`1.0` - `2.0`

---

## 🔍 调试技巧

### 1. 控制台输出

```javascript
if (snapped) {
    console.log('✅ 吸附成功:', {
        type: '点吸附' or '线吸附',
        distance: minDistance,
        position: bestPos
    });
}
```

### 2. 可视化调试

```javascript
// 显示吸附点
{isSnapped && (
    <mesh position={[bestPos.x, 0.1, bestPos.z]}>
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color="#ff0000" />
    </mesh>
)}
```

---

## ⚠️ 常见问题

### Q1: 为什么吸附不生效？

**检查清单**:
1. ✅ `window.__editorObjects` 是否有数据？
2. ✅ 对象的 `points` 字段是否正确？
3. ✅ 坐标转换是否正确（局部 → 世界）？
4. ✅ `SNAP_THRESHOLD` 是否太小？

### Q2: 为什么只吸附到网格？

**原因**: 对象的 `points` 字段为空或格式不正确

**解决**:
```javascript
// 检查对象结构
console.log('对象数据:', window.__editorObjects);

// 确保 points 格式正确
{
    points: [
        { x: 1.0, z: 2.0 },
        { x: 3.0, z: 4.0 }
    ]
}
```

### Q3: 为什么吸附位置不准确？

**原因**: 坐标系转换问题

**解决**:
```javascript
// 确保使用世界坐标
const worldX = p.x + (obj.position ? obj.position[0] : 0);
const worldZ = p.z + (obj.position ? obj.position[2] : 0);
```

---

## 🎯 使用效果

### 模式 1: 网格吸附（默认）

```
鼠标移动
    ↓
自动对齐到网格点 (0.5, 1.0, 1.5...)
    ↓
光标变蓝 🔵
    ↓
✅ 规整对齐
```

### 模式 2: 点/线吸附

```
鼠标靠近路径
    ↓
自动吸附到 (1.23, 0, 2.45)
    ↓
光标变绿 🟢
    ↓
✅ 精确对齐
```

### 模式 3: 自由模式（按住 Alt/Option）

```
按住 Alt 键
    ↓
鼠标指向 (1.234, 0, 2.567)
    ↓
光标变橙 🟠
    ↓
✅ 指哪打哪，完全自由
```

---

## 📊 性能优化

### 1. 过滤不必要的对象

```javascript
objects.forEach(obj => {
    // 忽略底图和隐藏对象
    if (obj.isBaseMap || obj.visible === false) return;
    
    // 只检测有 points 的对象
    if (!obj.points || obj.points.length === 0) return;
    
    // ... 吸附检测
});
```

### 2. 提前退出

```javascript
// 如果已经找到很近的点，提前退出
if (minDistance < 0.01) {
    return; // 已经足够精确
}
```

### 3. 空间分区（高级）

```javascript
// 使用四叉树或网格分区
// 只检测附近的对象
const nearbyObjects = spatialIndex.query(mousePos, SNAP_THRESHOLD);
```

---

## ✅ 测试清单

### 基础功能

- [ ] 鼠标靠近路径端点时，自动吸附
- [ ] 鼠标靠近路径线段时，沿线滑动
- [ ] 吸附时光标变绿
- [ ] 未吸附时光标变蓝
- [ ] 网格吸附作为保底

### 边界情况

- [ ] 路径为空时不报错
- [ ] 对象隐藏时不吸附
- [ ] 底图不参与吸附
- [ ] 多个吸附点时选择最近的

### 性能测试

- [ ] 100+ 对象时流畅运行
- [ ] 鼠标移动无卡顿
- [ ] 内存占用正常

---

## 🎓 扩展功能

### 1. 角度吸附

```javascript
// 吸附到 45° 倍数
const angle = Math.atan2(dz, dx);
const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
```

### 2. 距离吸附

```javascript
// 吸附到固定距离（如 1m, 2m）
const distance = Math.sqrt(dx * dx + dz * dz);
const snappedDistance = Math.round(distance);
```

### 3. 交叉点吸附

```javascript
// 吸附到两条路径的交叉点
const intersection = getLineIntersection(line1, line2);
if (intersection) {
    // 吸附到交叉点
}
```

---

## 📚 参考资料

- [Three.js Line3 API](https://threejs.org/docs/#api/en/math/Line3)
- [CAD 软件吸附逻辑](https://en.wikipedia.org/wiki/Snap_(computer_graphics))
- [空间索引算法](https://en.wikipedia.org/wiki/Quadtree)

---

**版本**: 1.0.0  
**最后更新**: 2025-11-24  
**实现状态**: ✅ 完成
