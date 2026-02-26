import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * 批量操作 Hook - 使用 objects 数组
 * 提供批量删除、复制、组合等功能
 */
export function useBatchOperations(objects, setObjects, commitHistory) {
  const [selectedObjects, setSelectedObjects] = useState([]);

  // 删除操作
  const handleDelete = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;

    // 🔑 过滤掉锁定对象和底图
    const deletableIds = selectedIds.filter(id => {
      const obj = objects.find(o => o.id === id);
      return obj && !obj.locked && !obj.isBaseMap;
    });

    const lockedCount = selectedIds.length - deletableIds.length;

    if (deletableIds.length === 0) {
      alert('选中的对象包含锁定对象或底图，无法删除');
      return;
    }

    let confirmMsg = `确定删除 ${deletableIds.length} 个对象？`;
    if (lockedCount > 0) {
      confirmMsg += `\n（已自动跳过 ${lockedCount} 个锁定对象/底图）`;
    }

    if (!window.confirm(confirmMsg)) return;

    const newObjects = objects.filter(obj => !deletableIds.includes(obj.id));
    setObjects(newObjects);
    if (commitHistory) commitHistory(newObjects);

    setSelectedObjects([]);
    console.log('🗑️ 已删除', deletableIds.length, '个对象');
    if (lockedCount > 0) {
      console.log('⚠️ 跳过', lockedCount, '个锁定对象/底图');
    }
  }, [objects, setObjects, commitHistory]);

  // 复制操作
  const handleDuplicate = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;

    const newObjects = [];
    const idMapping = {}; // 用于映射旧ID到新ID

    // 第一遍：创建所有新对象并建立ID映射
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id);
      if (obj) {
        const newId = uuidv4();
        idMapping[id] = newId;

        const newObj = {
          ...obj,
          id: newId,
          name: `${obj.name} 副本`,
          position: [...obj.position] // 原位粘贴，保持相同位置
        };

        // 如果是组对象，更新children的ID映射
        if (obj.type === 'group' && obj.children) {
          newObj.children = obj.children.map(childId => idMapping[childId] || childId);
        }

        // 如果有父对象，更新parentId
        if (obj.parentId && idMapping[obj.parentId]) {
          newObj.parentId = idMapping[obj.parentId];
        }

        newObjects.push(newObj);
      }
    });

    const allObjects = [...objects, ...newObjects];
    setObjects(allObjects);
    if (commitHistory) commitHistory(allObjects);

    console.log('📋 已复制', newObjects.length, '个对象');
    return newObjects.map(o => o.id);
  }, [objects, setObjects, commitHistory]);

  // 组合操作 - 支持嵌套组（组作为子组保留）
  const handleGroup = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length < 2) {
      alert('需要至少2个对象才能组合');
      return;
    }

    // 计算中心点 - 基于所有选中对象形成的包围盒中心，确保Gizmo在几何中心
    let minX = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxZ = -Infinity;
    let hasValidPositions = false;

    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id);
      if (obj && obj.position) {
        hasValidPositions = true;
        // 计算对象的世界坐标
        let worldX = obj.position[0];
        let worldZ = obj.position[2];

        if (obj.parentId && obj.relativePosition) {
          const parent = objects.find(o => o.id === obj.parentId);
          if (parent) {
            worldX = parent.position[0] + obj.relativePosition[0];
            worldZ = parent.position[2] + obj.relativePosition[2];
          }
        }

        const halfScaleX = (obj.scale ? obj.scale[0] : 1) / 2;
        const halfScaleZ = (obj.scale ? obj.scale[2] : 1) / 2;

        minX = Math.min(minX, worldX - halfScaleX);
        maxX = Math.max(maxX, worldX + halfScaleX);
        minZ = Math.min(minZ, worldZ - halfScaleZ);
        maxZ = Math.max(maxZ, worldZ + halfScaleZ);
      }
    });

    const avgX = hasValidPositions ? (minX + maxX) / 2 : 0;
    const avgY = 0; // Y轴保持为0
    const avgZ = hasValidPositions ? (minZ + maxZ) / 2 : 0;

    const groupId = uuidv4();

    // 更新对象：设置新的parentId和relativePosition
    // 组对象也可以作为子对象
    const newObjects = objects.map(obj => {
      if (selectedIds.includes(obj.id)) {
        // 如果对象没有position（如路径），只更新parentId，不设置relativePosition
        if (!obj.position) {
          return { ...obj, parentId: groupId };
        }

        // 计算对象的实际世界坐标
        let worldX = obj.position[0];
        let worldY = obj.position[1];
        let worldZ = obj.position[2];

        // 如果对象已经有parentId，说明它是某个组的子对象
        // 需要计算其世界坐标：父组position + relativePosition
        if (obj.parentId && obj.relativePosition) {
          const parent = objects.find(o => o.id === obj.parentId);
          if (parent) {
            worldX = parent.position[0] + obj.relativePosition[0];
            worldY = parent.position[1] + obj.relativePosition[1];
            worldZ = parent.position[2] + obj.relativePosition[2];
          }
        }

        return {
          ...obj,
          parentId: groupId,
          relativePosition: [
            worldX - avgX,
            worldY - avgY,
            worldZ - avgZ
          ]
        };
      }
      return obj;
    });

    // 创建新组对象
    const groupNumber = objects.filter(o => o.type === 'group').length + 1;
    const groupObj = {
      id: groupId,
      type: 'group',
      name: `组合 ${groupNumber}`,
      position: [avgX, avgY, avgZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      children: selectedIds,
      visible: true,
      locked: false,
      color: '#888888'
    };

    newObjects.push(groupObj);
    setObjects(newObjects);
    if (commitHistory) commitHistory(newObjects);

    console.log('📦 已组合', selectedIds.length, '个对象（包括子组），组ID:', groupId);
    return groupObj.id;
  }, [objects, setObjects, commitHistory]);

  // 解组操作
  const handleUngroup = useCallback((groupId) => {
    const groupObj = objects.find(o => o.id === groupId);
    if (!groupObj || groupObj.type !== 'group') {
      console.warn('⚠️ 不是有效的组对象');
      return;
    }

    // 移除子对象的 parentId 和 relativePosition，恢复为独立对象
    const newObjects = objects.map(obj => {
      if (obj.parentId === groupId) {
        // 计算对象的世界坐标
        let worldX = obj.position[0];
        let worldY = obj.position[1];
        let worldZ = obj.position[2];

        // 如果对象有relativePosition，计算其世界坐标
        if (obj.relativePosition && groupObj) {
          worldX = groupObj.position[0] + obj.relativePosition[0];
          worldY = groupObj.position[1] + obj.relativePosition[1];
          worldZ = groupObj.position[2] + obj.relativePosition[2];
        }

        // 移除parentId和relativePosition，更新position为世界坐标
        const { parentId, relativePosition, ...rest } = obj;
        return {
          ...rest,
          position: [worldX, worldY, worldZ]
        };
      }
      return obj;
    }).filter(obj => obj.id !== groupId); // 删除组对象本身

    setObjects(newObjects);
    if (commitHistory) commitHistory(newObjects);

    console.log('📂 已解组，组ID:', groupId);
    return groupObj.children || [];
  }, [objects, setObjects, commitHistory]);

  // 清除选择
  const handleClear = useCallback(() => {
    setSelectedObjects([]);
  }, []);

  return {
    selectedObjects,
    setSelectedObjects,
    handleDelete,
    handleDuplicate,
    handleGroup,
    handleUngroup,
    handleClear
  };
}
