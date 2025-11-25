import { useEffect, useRef } from 'react';
import { SelectionBox } from 'three/examples/jsm/interactive/SelectionBox';
import { SelectionHelper } from 'three/examples/jsm/interactive/SelectionHelper';

// 框选功能
function BoxSelection({ camera, scene, renderer, onSelectionChange, enabled = true }) {
  const selectionBoxRef = useRef();
  const selectionHelperRef = useRef();
  const isSelectingRef = useRef(false);

  useEffect(() => {
    if (!camera || !scene || !renderer || !enabled) return;

    const selectionBox = new SelectionBox(camera, scene);
    const selectionHelper = new SelectionHelper(renderer, 'selectBox');

    selectionBoxRef.current = selectionBox;
    selectionHelperRef.current = selectionHelper;

    const handlePointerDown = (event) => {
      // 直接拖动即可框选（不需要 Shift 键）
      if (!enabled) return;

      isSelectingRef.current = true;

      selectionBox.startPoint.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5
      );

      console.log('🎯 开始批量框选');
    };

    const handlePointerMove = (event) => {
      if (!isSelectingRef.current) return;

      selectionBox.endPoint.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5
      );
    };

    const handlePointerUp = (event) => {
      if (!isSelectingRef.current) return;

      isSelectingRef.current = false;

      selectionBox.endPoint.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5
      );

      // 获取框选的对象
      const allSelected = selectionBox.select();
      
      // 过滤掉不可选择的对象
      const validSelected = allSelected.filter(obj => 
        obj.userData.selectable !== false &&
        !obj.userData.isGround &&
        obj.type !== 'GridHelper' &&
        obj.type !== 'TransformControlsGizmo' &&
        obj.type !== 'TransformControlsPlane'
      );

      console.log('✅ 框选完成:', validSelected.length, '个对象');

      if (onSelectionChange) {
        onSelectionChange(validSelected);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      
      if (selectionHelper.element && selectionHelper.element.parentNode) {
        selectionHelper.element.parentNode.removeChild(selectionHelper.element);
      }
    };
  }, [camera, scene, renderer, onSelectionChange]);

  return null;
}

export default BoxSelection;
