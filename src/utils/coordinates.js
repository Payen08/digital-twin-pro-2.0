/**
 * ROS 坐标系转换到 Three.js 坐标系
 * ROS: X-forward, Y-left, Z-up
 * Three.js: X-right, Y-up, Z-forward
 */
export const rosToThreeJS = (rosCoord) => {
    return {
        x: -rosCoord.y,  // ROS Y (left) -> Three.js -X (right)
        y: rosCoord.z,   // ROS Z (up) -> Three.js Y (up)
        z: rosCoord.x    // ROS X (forward) -> Three.js Z (forward)
    };
};

/**
 * Three.js 坐标系转换到 ROS 坐标系
 */
export const threeJSToROS = (threeCoord) => {
    return {
        x: threeCoord.z,   // Three.js Z -> ROS X
        y: -threeCoord.x,  // Three.js -X -> ROS Y
        z: threeCoord.y    // Three.js Y -> ROS Z
    };
};
