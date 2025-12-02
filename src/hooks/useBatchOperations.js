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

  // 组合操作 - 支持组与组、组与对象合并
  const handleGroup = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length < 2) {
      alert('需要至少2个对象才能组合');
      return;
    }
    
    // 收集所有要组合的对象ID（包括组的子对象）
    const allObjectIds = [];
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id);
      if (obj) {
        if (obj.type === 'group' && obj.children) {
          // 如果是组，添加其所有子对象
          allObjectIds.push(...obj.children);
        } else {
          // 如果是普通对象，直接添加
          allObjectIds.push(id);
        }
      }
    });
    
    // 去重
    const uniqueObjectIds = [...new Set(allObjectIds)];
    
    if (uniqueObjectIds.length < 2) {
      alert('需要至少2个对象才能组合');
      return;
    }
    
    // 计算中心点 - 基于所有对象的绝对位置
    let totalX = 0, totalZ = 0;
    uniqueObjectIds.forEach(id => {
      const obj = objects.find(o => o.id === id);
      if (obj) {
        // 如果对象有父组，使用绝对位置
        if (obj.parentId && obj.relativePosition) {
          const parent = objects.find(o => o.id === obj.parentId);
          if (parent) {
            totalX += parent.position[0] + obj.relativePosition[0];
            totalZ += parent.position[2] + obj.relativePosition[2];
          }
        } else {
          totalX += obj.position[0];
          totalZ += obj.position[2];
        }
      }
    });
    
    const avgX = totalX / uniqueObjectIds.length;
    const avgY = 0; // Y轴保持为0
    const avgZ = totalZ / uniqueObjectIds.length;
    
    const groupId = uuidv4();
    
    // 更新对象：设置新的parentId和relativePosition
    const newObjects = objects.map(obj => {
      if (uniqueObjectIds.includes(obj.id)) {
        // 计算对象的绝对位置
        let absX, absY, absZ;
        if (obj.parentId && obj.relativePosition) {
          const parent = objects.find(o => o.id === obj.parentId);
          if (parent) {
            absX = parent.position[0] + obj.relativePosition[0];
            absY = parent.position[1] + obj.relativePosition[1];
            absZ = parent.position[2] + obj.relativePosition[2];
          } else {
            absX = obj.position[0];
            absY = obj.position[1];
            absZ = obj.position[2];
          }
        } else {
          absX = obj.position[0];
          absY = obj.position[1];
          absZ = obj.position[2];
        }
        
        return {
          ...obj,
          parentId: groupId,
          relativePosition: [
            absX - avgX,
            absY - avgY,
            absZ - avgZ
          ]
        };
      }
      return obj;
    }).filter(obj => {
      // 移除旧的组对象
      return !(obj.type === 'group' && selectedIds.includes(obj.id));
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
      children: uniqueObjectIds,
      visible: true,
      locked: false,
      color: '#888888'
    };
    
    newObjects.push(groupObj);
    setObjects(newObjects);
    if (commitHistory) commitHistory(newObjects);
    
    console.log('📦 已组合', uniqueObjectIds.length, '个对象，组ID:', groupId);
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
