import React from 'react';
import * as THREE from 'three';
import '../styles/BatchOperations.css';

// 对齐函数
function alignObjects(objects, type) {
  if (objects.length === 0) return;

  const box = new THREE.Box3();
  objects.forEach(obj => box.expandByObject(obj));

  const center = new THREE.Vector3();
  box.getCenter(center);

  objects.forEach(obj => {
    const objBox = new THREE.Box3().setFromObject(obj);
    const objCenter = new THREE.Vector3();
    objBox.getCenter(objCenter);

    switch(type) {
      case 'left':
        obj.position.x += (box.min.x - objBox.min.x);
        break;
      case 'right':
        obj.position.x += (box.max.x - objBox.max.x);
        break;
      case 'center':
        obj.position.x += (center.x - objCenter.x);
        break;
      case 'top':
        obj.position.y += (box.max.y - objBox.max.y);
        break;
      case 'bottom':
        obj.position.y += (box.min.y - objBox.min.y);
        break;
      case 'middle':
        obj.position.y += (center.y - objCenter.y);
        break;
    }
  });

  console.log('✅ 对齐完成:', type);
}

// 分布函数
function distributeObjects(objects, axis = 'x') {
  if (objects.length < 3) {
    alert('需要至少3个对象才能分布');
    return;
  }

  const sorted = [...objects].sort((a, b) => 
    a.position[axis] - b.position[axis]
  );

  const first = sorted[0].position[axis];
  const last = sorted[sorted.length - 1].position[axis];
  const gap = (last - first) / (sorted.length - 1);

  sorted.forEach((obj, index) => {
    obj.position[axis] = first + gap * index;
  });

  console.log('✅ 分布完成:', axis, '轴');
}

// 批量操作面板（精简版）
function BatchOperations({ selectedObjects, onClear, onDelete, onDuplicate, onGroup }) {
  if (selectedObjects.length === 0) return null;

  return (
    <div className="batch-operations-panel">
      <div className="selection-info">
        已选择 {selectedObjects.length} 个对象
      </div>
      
      <div className="operation-buttons">
        <button onClick={() => onDelete(selectedObjects)}>
          🗑️ 删除
        </button>
        
        <button onClick={() => onDuplicate(selectedObjects)}>
          📋 复制
        </button>
        
        <button onClick={() => onGroup(selectedObjects)}>
          📦 组合
        </button>
        
        <button onClick={() => {
          const scale = parseFloat(prompt('输入缩放比例', '1.5'));
          if (scale && !isNaN(scale)) {
            selectedObjects.forEach(obj => {
              obj.scale.multiplyScalar(scale);
            });
          }
        }}>
          📏 缩放
        </button>
        
        <button onClick={() => {
          const angle = parseFloat(prompt('输入旋转角度', '45'));
          if (angle && !isNaN(angle)) {
            selectedObjects.forEach(obj => {
              obj.rotateY(THREE.MathUtils.degToRad(angle));
            });
          }
        }}>
          🔄 旋转
        </button>
        
        <button onClick={() => {
          const alignType = prompt('对齐方式: left, center, right, top, bottom', 'center');
          if (alignType) {
            alignObjects(selectedObjects, alignType);
          }
        }}>
          📐 对齐
        </button>
        
        <button onClick={() => distributeObjects(selectedObjects, 'x')}>
          ↔️ 水平分布
        </button>
        
        <button onClick={() => distributeObjects(selectedObjects, 'z')}>
          ↕️ 垂直分布
        </button>
        
        <button onClick={onClear} className="clear-btn">
          ❌ 取消选择
        </button>
      </div>
    </div>
  );
}

export default BatchOperations;
