import React, { useRef } from 'react';
import {
    BrickWall, DoorOpen, Columns, LandPlot, Server, Box as BoxIcon,
    PenTool, Spline, Upload, Map as MapIcon, FileJson, PlusSquare,
    Search, Lock, Unlock, Eye, EyeOff, Layers
} from 'lucide-react';
import { builtInMapTemplates } from '../../data/builtInMaps';

const SidebarItem = ({ asset, onDragStart, onEdit }) => (
    <div
        draggable
        onDragStart={onDragStart}
        className="flex items-center gap-2 p-2 rounded-md cursor-move hover:bg-[#222] transition-colors group"
    >
        <div className="w-8 h-8 bg-[#222] rounded flex items-center justify-center border border-[#333] group-hover:border-blue-500/50 transition-colors">
            <asset.icon size={16} className="text-gray-400 group-hover:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-gray-300 truncate group-hover:text-white">{asset.label}</div>
            <div className="text-[9px] text-gray-500">{asset.category}</div>
        </div>
        {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(asset); }} className="text-[9px] text-blue-400 hover:underline opacity-0 group-hover:opacity-100">编辑</button>}
    </div>
);

const Sidebar = ({
    sidebarTab,
    setSidebarTab,
    searchQuery,
    setSearchQuery,
    toolMode,
    setToolMode,
    setShowSLAMUpload,
    setShowMapSelector,
    handleJSONImport,
    handleAddAsset,
    defaultAssets,
    customAssets,
    setEditingAsset,
    objects,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    updateObject,
    batchReplaceWaypointModels,
    jsonImportRef,
    assetUploadRef,
    // 楼层相关
    currentScene,
    currentFloorLevelId,
    setCurrentFloorLevelId
}) => {

    const filteredObjects = objects.filter(obj =>
        (obj.name && obj.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (obj.type && obj.type.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const allAssets = [...defaultAssets, ...customAssets];
    const filteredAssets = allAssets.filter(asset => asset.label.toLowerCase().includes(searchQuery.toLowerCase()));

    // 选中点位的数量
    const selectedWaypointsCount = selectedIds.filter(id =>
        objects.find(o => o.id === id && o.type === 'waypoint')
    ).length;

    return (
        <div className="w-64 flex flex-col border-r border-[#1a1a1a] bg-[#0f0f0f]">
            {/* Header */}
            <div className="h-14 flex items-center px-4 gap-3 border-b border-[#1a1a1a]">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold text-white">DT</div>
                <span className="text-xs font-bold tracking-wide text-white">Digital Twin Pro</span>
            </div>

            {/* Search & Tabs */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex bg-[#1a1a1a] p-1 rounded-md mb-2">
                    <button
                        onClick={() => setSidebarTab('assets')}
                        className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${sidebarTab === 'assets' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        资源库
                    </button>
                    <button
                        onClick={() => setSidebarTab('layers')}
                        className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${sidebarTab === 'layers' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        图层
                    </button>
                </div>
                <div className="bg-[#1a1a1a] flex items-center px-2 py-1.5 rounded-md border border-[#2a2a2a] focus-within:border-blue-500/50 transition-colors">
                    <Search size={12} className="text-gray-500 mr-2" />
                    <input
                        type="text"
                        placeholder="搜索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-[11px] w-full text-gray-300 placeholder-gray-600"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pt-0">
                {sidebarTab === 'assets' && (
                    <div className="space-y-4 pt-2">
                        {/* Tools */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">创建工具</div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setToolMode('draw_wall')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_wall' ? 'border-blue-500 text-blue-400' : 'text-gray-400'}`}><PenTool size={18} /> <span className="text-[10px]">直墙</span></button>
                                <button onClick={() => setToolMode('draw_curve')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_curve' ? 'border-purple-500 text-purple-400' : 'text-gray-400'}`}><Spline size={18} /> <span className="text-[10px]">连续曲线</span></button>
                                <button onClick={() => setToolMode('draw_floor')} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all ${toolMode === 'draw_floor' ? 'border-orange-500 text-orange-400' : 'text-gray-400'}`}><LandPlot size={18} /> <span className="text-[10px]">多边形</span></button>
                            </div>
                        </div>

                        {/* SLAM Maps */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">SLAM 地图</div>
                            <button onClick={() => setShowMapSelector(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-md bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all text-white border border-green-500/50 mb-2">
                                <MapIcon size={16} />
                                <span className="text-[11px] font-bold">选择内置地图</span>
                            </button>
                            <button onClick={() => setShowSLAMUpload(true)} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all text-white border border-blue-500/50">
                                <Upload size={16} />
                                <span className="text-[11px] font-bold">上传 SLAM 地图</span>
                            </button>
                        </div>

                        {/* Import JSON */}
                        <div className="mt-2">
                            <button onClick={() => jsonImportRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-[#222] hover:bg-[#333] transition-all text-gray-300 border border-[#333]"><FileJson size={16} /> <span className="text-[11px]">导入工程 JSON</span></button>
                            <input type="file" ref={jsonImportRef} className="hidden" accept=".json" onChange={handleJSONImport} />
                        </div>

                        {/* Batch Replace */}
                        {selectedWaypointsCount > 0 && (
                            <div className="mt-2">
                                <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">
                                    批量替换 ({selectedWaypointsCount} 个点位)
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => batchReplaceWaypointModels('cnc')} className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all text-gray-400 hover:text-blue-400">
                                        <Server size={14} />
                                        <span className="text-[9px]">CNC</span>
                                    </button>
                                    <button onClick={() => batchReplaceWaypointModels('cube')} className="flex flex-col items-center gap-1 p-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#252525] transition-all text-gray-400 hover:text-blue-400">
                                        <BoxIcon size={14} />
                                        <span className="text-[9px]">正方体</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Import Asset */}
                        <div className="border border-dashed border-[#333] rounded-md p-3 text-center hover:border-blue-500/50 transition-colors cursor-pointer group" onClick={() => assetUploadRef.current?.click()}>
                            <input type="file" ref={assetUploadRef} className="hidden" accept=".glb,.gltf" onChange={handleAddAsset} />
                            <PlusSquare size={20} className="mx-auto text-gray-500 group-hover:text-blue-400 mb-1" />
                            <span className="text-[10px] text-gray-500 group-hover:text-blue-300">导入新资产 (.glb)</span>
                        </div>

                        {/* Base Assets */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1">基础组件</div>
                            <div className="space-y-1">
                                {filteredAssets.filter(a => a.category !== '自定义').map((asset, idx) => (
                                    <SidebarItem key={idx} asset={asset} onDragStart={(e) => { e.dataTransfer.setData('type', asset.type); e.dataTransfer.effectAllowed = 'copy'; }} />
                                ))}
                            </div>
                        </div>

                        {/* Custom Assets */}
                        {customAssets.length > 0 && (
                            <div>
                                <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1 mt-2">自定义资产</div>
                                <div className="space-y-1">
                                    {filteredAssets.filter(a => a.category === '自定义').map((asset, idx) => (
                                        <SidebarItem key={`custom-${idx}`} asset={asset} onEdit={setEditingAsset} onDragStart={(e) => { e.dataTransfer.setData('type', 'custom_model'); e.dataTransfer.setData('assetId', asset.id); e.dataTransfer.effectAllowed = 'copy'; }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {sidebarTab === 'layers' && (
                    <div className="pt-2">
                        {/* 楼层切换 */}
                        {currentScene && currentScene.floorLevels && currentScene.floorLevels.length > 1 && (
                            <div className="mb-4">
                                <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1 flex items-center gap-2">
                                    <Layers size={12} />
                                    <span>楼层</span>
                                </div>
                                <div className="bg-[#1a1a1a] rounded-md p-1 space-y-1">
                                    {currentScene.floorLevels.map((floor) => (
                                        <button
                                            key={floor.id}
                                            onClick={() => setCurrentFloorLevelId(floor.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded text-[11px] transition-all ${
                                                currentFloorLevelId === floor.id
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200'
                                            }`}
                                        >
                                            <span className="font-medium">{floor.name}</span>
                                            <span className="text-[9px] opacity-70">
                                                {floor.objects?.length || 0} 对象
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-1 flex justify-between">
                            <span>场景对象</span>
                            <span className="bg-[#222] px-1.5 rounded text-[9px]">{filteredObjects.length}</span>
                        </div>
                        <div className="space-y-0.5">
                            {[...filteredObjects].reverse().map(obj => (
                                <div
                                    key={obj.id}
                                    onClick={(e) => {
                                        if (!obj.locked) {
                                            setToolMode('select');
                                            if (e.shiftKey) {
                                                const newIds = selectedIds.includes(obj.id) ? selectedIds.filter(id => id !== obj.id) : [...selectedIds, obj.id];
                                                setSelectedIds(newIds);
                                                setSelectedId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
                                            } else {
                                                setSelectedId(obj.id);
                                                setSelectedIds([obj.id]);
                                            }
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px] transition-colors ${selectedIds.includes(obj.id) ? 'bg-blue-900/30 text-blue-100 border-l-2 border-blue-500' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300 border-l-2 border-transparent'} ${obj.locked ? 'opacity-50' : ''}`}
                                >
                                    <div className="min-w-[16px] flex justify-center">
                                        {obj.isBaseMap ? <MapIcon size={12} className="text-blue-400" /> : (obj.type.includes('wall') ? <BrickWall size={12} /> : obj.type === 'floor' ? <LandPlot size={12} /> : <BoxIcon size={12} />)}
                                    </div>
                                    <span className="truncate flex-1">{obj.name}</span>
                                    {!obj.isBaseMap && <button onClick={(e) => { e.stopPropagation(); updateObject(obj.id, 'locked', !obj.locked); }} className="hover:text-white p-1 rounded hover:bg-[#333]" title={obj.locked ? "解锁" : "锁定"}>{obj.locked ? <Lock size={10} /> : <Unlock size={10} />}</button>}
                                    {!obj.isBaseMap && <button onClick={(e) => { e.stopPropagation(); updateObject(obj.id, 'visible', !obj.visible); }} className="hover:text-white p-1 rounded hover:bg-[#333]">{obj.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
