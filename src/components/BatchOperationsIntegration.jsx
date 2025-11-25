/**
 * 批量操作集成示例
 * 
 * 这个文件展示了如何在你的 App.jsx 中集成批量操作功能
 * 
 * 使用步骤：
 * 1. 在 App.jsx 中导入所需组件和 Hook
 * 2. 在 Canvas 内部创建一个组件来访问 useThree
 * 3. 在 Canvas 外部渲染批量操作面板
 */

import React from 'react';
import { useThree } from '@react-three/fiber';
import BoxSelection from './BoxSelection';
import BatchOperations from './BatchOperations';
import { useBatchOperations } from '../hooks/useBatchOperations';

/**
 * 场景内部组件 - 用于访问 Three.js 上下文
 * 必须放在 <Canvas> 内部
 */
export function SceneWithBatchSelection({ onSelectionChange }) {
  const { camera, scene, gl: renderer } = useThree();

  return (
    <BoxSelection
      camera={camera}
      scene={scene}
      renderer={renderer}
      onSelectionChange={onSelectionChange}
    />
  );
}

/**
 * 完整集成示例
 * 
 * 在你的 App.jsx 中这样使用：
 * 
 * ```jsx
 * import { SceneWithBatchSelection } from './components/BatchOperationsIntegration';
 * import BatchOperations from './components/BatchOperations';
 * import { useBatchOperations } from './hooks/useBatchOperations';
 * 
 * function App() {
 *   const [scene, setScene] = useState(null);
 *   
 *   // 在 Canvas 内部获取 scene 引用
 *   function SceneRef() {
 *     const { scene } = useThree();
 *     useEffect(() => {
 *       setScene(scene);
 *     }, [scene]);
 *     return null;
 *   }
 *   
 *   const {
 *     selectedObjects,
 *     setSelectedObjects,
 *     handleDelete,
 *     handleDuplicate,
 *     handleGroup,
 *     handleClear
 *   } = useBatchOperations(scene);
 * 
 *   return (
 *     <>
 *       <Canvas>
 *         <SceneRef />
 *         <SceneWithBatchSelection onSelectionChange={setSelectedObjects} />
 *         
 *         {/* 你的其他场景内容 *\/}
 *       </Canvas>
 * 
 *       {/* 批量操作面板 - 在 Canvas 外部 *\/}
 *       <BatchOperations
 *         selectedObjects={selectedObjects}
 *         onClear={handleClear}
 *         onDelete={handleDelete}
 *         onDuplicate={handleDuplicate}
 *         onGroup={handleGroup}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

export default function BatchOperationsExample() {
  return (
    <div>
      <h2>批量操作集成示例</h2>
      <p>请查看此文件的注释了解如何集成到你的 App.jsx</p>
    </div>
  );
}
