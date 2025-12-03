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
    if (!window.confirm(`确定删除 ${selectedIds.length} 个对象？`)) return;

    const newObjects = objects.filter(obj => !selectedIds.includes(obj.id));
    setObjects(newObjects);
    if (commitHistory) commitHistory(newObjects);
    
    setSelectedObjects([]);
    console.log('🗑️ 已删除', selectedIds.length, '个对象');
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
    
    // 计算中心点 - 基于所有选中对象的位置
    let totalX = 0, totalZ = 0;
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id);
      if (obj) {
        totalX += obj.position[0];
        totalZ += obj.position[2];
      }
    });
    
    const avgX = totalX / selectedIds.length;
    const avgY = 0; // Y轴保持为0
    const avgZ = totalZ / selectedIds.length;
    
    const groupId = uuidv4();
    
    // 更新对象：设置新的parentId和relativePosition
    // 组对象也可以作为子对象
    const newObjects = objects.map(obj => {
      if (selectedIds.includes(obj.id)) {
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
        const { parentId, relativePosition, ...rest } = obj;
        return rest;
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
