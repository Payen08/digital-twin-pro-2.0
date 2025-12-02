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

  // 组合操作
  const handleGroup = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length < 2) {
      alert('需要至少2个对象才能组合');
      return;
    }
    
    // 计算中心点 - 只计算X和Z的平均值，Y保持为0（地面高度）
    const avgX = selectedIds.reduce((sum, id) => {
      const obj = objects.find(o => o.id === id);
      return sum + (obj?.position[0] || 0);
    }, 0) / selectedIds.length;
    
    // Y轴保持为0，避免在俯视图下出现高度问题
    const avgY = 0;
    
    const avgZ = selectedIds.reduce((sum, id) => {
      const obj = objects.find(o => o.id === id);
      return sum + (obj?.position[2] || 0);
    }, 0) / selectedIds.length;
    
    const groupId = uuidv4();
    
    // 标记子对象为组成员，并调整相对位置
    const newObjects = objects.map(obj => {
      if (selectedIds.includes(obj.id)) {
        return {
          ...obj,
          parentId: groupId,
          // 保存相对于组中心的偏移
          relativePosition: [
            obj.position[0] - avgX,
            obj.position[1] - avgY,
            obj.position[2] - avgZ
          ]
        };
      }
      return obj;
    });
    
    // 创建组对象
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
    
    console.log('📦 已组合', selectedIds.length, '个对象，组ID:', groupId);
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
