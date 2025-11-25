import React from 'react';
import { Grid } from '@react-three/drei';

const InfiniteGrid = () => {
    return (
        <group>
            <Grid
                infiniteGrid
                fadeDistance={50}
                fadeStrength={1.5}
                cellSize={1}
                sectionSize={10}
                sectionThickness={1.5}
                cellColor="#444444"
                sectionColor="#666666"
                cellThickness={0.6}
                position={[0, -0.01, 0]}
            />
            {/* X Axis - Red */}
            <line position={[0, 0.01, 0]}>
                <bufferGeometry attach="geometry">
                    <float32BufferAttribute attach="attributes-position" args={[new Float32Array([-1000, 0, 0, 1000, 0, 0]), 3]} />
                </bufferGeometry>
                <lineBasicMaterial attach="material" color="#ff4444" linewidth={2} opacity={0.8} transparent />
            </line>
            {/* Z Axis - Blue */}
            <line position={[0, 0.01, 0]}>
                <bufferGeometry attach="geometry">
                    <float32BufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, -1000, 0, 0, 1000]), 3]} />
                </bufferGeometry>
                <lineBasicMaterial attach="material" color="#4444ff" linewidth={2} opacity={0.8} transparent />
            </line>
        </group>
    );
};

export default InfiniteGrid;
