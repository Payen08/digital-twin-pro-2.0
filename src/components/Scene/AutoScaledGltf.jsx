import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 自动缩放的 GLTF 模型组件
 * 根据 SLAM 底图边界自动缩放模型
 */
const AutoScaledGltf = ({
    src,
    targetWidth,  // 目标宽度（米）- SLAM 底图宽度
    targetHeight, // 目标高度/深度（米）- SLAM 底图高度  
    autoScale = true,  // 是否启用自动缩放
    preserveAspectRatio = true, // 是否保持比例
    onScaleCalculated,  // 缩放计算完成回调
    ...props
}) => {
    const groupRef = useRef();
    const { scene } = useGLTF(src);
    const [calculatedScale, setCalculatedScale] = useState(1);

    // 克隆场景以避免多次使用同一 GLTF 时的问题
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    useEffect(() => {
        if (!clonedScene || !autoScale || !targetWidth || !targetHeight) {
            setCalculatedScale(1);
            return;
        }

        // 计算模型的边界框
        const box = new THREE.Box3().setFromObject(clonedScene);
        const modelSize = new THREE.Vector3();
        box.getSize(modelSize);

        console.log('🔧 模型原始尺寸:', {
            width: modelSize.x.toFixed(2),
            height: modelSize.y.toFixed(2),
            depth: modelSize.z.toFixed(2)
        });
        console.log('🎯 目标SLAM尺寸:', {
            width: targetWidth.toFixed(2),
            height: targetHeight.toFixed(2)
        });

        // 计算缩放因子（使模型适配到 SLAM 边界）
        // X 对应 width，Z 对应 height/depth
        const scaleX = targetWidth / modelSize.x;
        const scaleZ = targetHeight / modelSize.z;

        let finalScale;
        if (preserveAspectRatio) {
            // 保持比例：使用较小的缩放因子确保模型完全在边界内
            finalScale = Math.min(scaleX, scaleZ);
        } else {
            // 不保持比例：分别缩放 X 和 Z（这里简化为使用平均值）
            finalScale = (scaleX + scaleZ) / 2;
        }

        console.log('📐 计算缩放因子:', {
            scaleX: scaleX.toFixed(4),
            scaleZ: scaleZ.toFixed(4),
            finalScale: finalScale.toFixed(4)
        });

        setCalculatedScale(finalScale);

        if (onScaleCalculated) {
            onScaleCalculated(finalScale, modelSize, { width: targetWidth, height: targetHeight });
        }
    }, [clonedScene, targetWidth, targetHeight, autoScale, preserveAspectRatio, onScaleCalculated]);

    // 计算模型中心点偏移，使其居中
    const centerOffset = useMemo(() => {
        if (!clonedScene) return [0, 0, 0];

        const box = new THREE.Box3().setFromObject(clonedScene);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // 返回反向偏移，使模型居中于原点
        return [-center.x * calculatedScale, 0, -center.z * calculatedScale];
    }, [clonedScene, calculatedScale]);

    return (
        <group ref={groupRef} position={centerOffset}>
            <primitive
                object={clonedScene}
                scale={calculatedScale}
                castShadow
                receiveShadow
                {...props}
            />
        </group>
    );
};

export default AutoScaledGltf;
