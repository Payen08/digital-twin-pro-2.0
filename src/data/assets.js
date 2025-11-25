import { BrickWall, DoorOpen, Columns, LandPlot, Box as BoxIcon, Server } from 'lucide-react';

export const defaultAssets = [
    { type: 'wall', label: '标准墙体 (Wall)', icon: BrickWall, category: '建筑' },
    { type: 'door', label: '标准门 (Door)', icon: DoorOpen, category: '建筑' },
    { type: 'column', label: '标准柱子 (Column)', icon: Columns, category: '建筑' },
    { type: 'floor', label: '标准地面 (Floor)', icon: LandPlot, category: '建筑' },
    { type: 'cube', label: '正方体 (Cube)', icon: BoxIcon, category: '建筑' },
    // 临时移除本地 GLB 引用，防止 404 错误。请将 cnc.glb 放入 public 目录后恢复
    { type: 'cnc', label: 'CNC 加工中心', icon: Server, category: '设备', modelUrl: null, modelScale: 1 },
];
