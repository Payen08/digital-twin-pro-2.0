# 多选拖动修复方案

## 问题分析

当前问题：
1. ✅ Hover 事件能触发（有 OVER/OUT 日志）
2. ❌ Click 和 PointerDown事件不触发
3. ❌ SelectionManager 的 canvas 级别事件仍在干扰

## 根本原因

R3F的mesh事件系统与Sel

ectionManager的canvas事件冲突，导致点击事件无法正常传递。

## 解决方案

### 方法1：完全禁用 SelectionManager 对 gizmo 的检测（已实现但无效）

### 方法2：使用 Canvas 事件捕获阶段（推荐）

把 giz mo 的事件监听器放在捕获阶段，优先于 SelectionManager 执行。

```javascript
// 在 useEffect 中
canvas.addEventListener('pointerdown', handlePointerDown, { capture: true });
```

### 方法3：移除所有 mesh 事件，直接用 raycaster

不使用 R3F 的 onClick/onPointerDown，而是：
1. 在 canvas 上监听事件
2. 用 raycaster 检测是否点击了 gizmo
3. 如果是，启动拖动

## 立即执行

我将实现方法3，完全重写 MultiSelectTransformControls。
