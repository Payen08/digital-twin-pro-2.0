import React from 'react';
import { Settings, Unlock, Lock, Trash2, Copy } from 'lucide-react';

const PropRow = ({ label, children }) => (
    <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-[10px]">{label}</span>
        <div className="flex items-center gap-2 w-2/3 justify-end">{children}</div>
    </div>
);

const DarkInput = ({ value, onChange, type = "text", step, className = "" }) => (
    <input
        type={type}
        step={step}
        value={value}
        onChange={onChange}
        className={`bg-[#0f0f0f] border border-[#333] rounded px-2 py-1 text-[10px] text-right text-gray-300 outline-none focus:border-blue-500 w-full ${className}`}
    />
);

const PropertiesPanel = ({
    selectedId,
    objects,
    updateTransform,
    updateObject,
    deleteSelected,
    copySelected
}) => {
    const selectedObject = objects.find(o => o.id === selectedId);

    if (!selectedObject) {
        return (
            <div className="w-60 bg-[#0f0f0f] border-l border-[#1a1a1a] p-4 flex flex-col items-center justify-center text-gray-600">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-3">
                    <Settings size={20} />
                </div>
                <span className="text-xs">未选择对象</span>
            </div>
        );
    }

    return (
        <div className="w-60 bg-[#0f0f0f] border-l border-[#1a1a1a] flex flex-col">
            <div className="h-14 flex items-center px-4 border-b border-[#1a1a1a] justify-between">
                <span className="text-xs font-bold text-white truncate w-32" title={selectedObject.name}>{selectedObject.name}</span>
                <div className="flex items-center gap-1">
                    <button onClick={() => updateObject(selectedObject.id, 'locked', !selectedObject.locked)} className="p-1.5 hover:bg-[#222] rounded text-gray-500 hover:text-white" title={selectedObject.locked ? "解锁" : "锁定"}>
                        {selectedObject.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button onClick={copySelected} className="p-1.5 hover:bg-[#222] rounded text-gray-500 hover:text-blue-400" title="复制">
                        <Copy size={12} />
                    </button>
                    <button onClick={deleteSelected} className="p-1.5 hover:bg-[#222] rounded text-gray-500 hover:text-red-400" title="删除">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="mb-6">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-3 px-1">变换</div>
                    <div className="space-y-1">
                        <PropRow label="位置">
                            <div className="flex gap-1">
                                <DarkInput value={selectedObject.position[0].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'position', 0, parseFloat(e.target.value))} type="number" step="0.1" className="text-red-400" />
                                <DarkInput value={selectedObject.position[1].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'position', 1, parseFloat(e.target.value))} type="number" step="0.1" className="text-green-400" />
                                <DarkInput value={selectedObject.position[2].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'position', 2, parseFloat(e.target.value))} type="number" step="0.1" className="text-blue-400" />
                            </div>
                        </PropRow>
                        <PropRow label="旋转">
                            <div className="flex gap-1">
                                <DarkInput value={(selectedObject.rotation[0] * 180 / Math.PI).toFixed(0)} onChange={(e) => updateTransform(selectedObject.id, 'rotation', 0, parseFloat(e.target.value) * Math.PI / 180)} type="number" step="15" />
                                <DarkInput value={(selectedObject.rotation[1] * 180 / Math.PI).toFixed(0)} onChange={(e) => updateTransform(selectedObject.id, 'rotation', 1, parseFloat(e.target.value) * Math.PI / 180)} type="number" step="15" />
                                <DarkInput value={(selectedObject.rotation[2] * 180 / Math.PI).toFixed(0)} onChange={(e) => updateTransform(selectedObject.id, 'rotation', 2, parseFloat(e.target.value) * Math.PI / 180)} type="number" step="15" />
                            </div>
                        </PropRow>
                        <PropRow label="缩放">
                            <div className="flex gap-1">
                                <DarkInput value={selectedObject.scale[0].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'scale', 0, parseFloat(e.target.value))} type="number" step="0.1" />
                                <DarkInput value={selectedObject.scale[1].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'scale', 1, parseFloat(e.target.value))} type="number" step="0.1" />
                                <DarkInput value={selectedObject.scale[2].toFixed(2)} onChange={(e) => updateTransform(selectedObject.id, 'scale', 2, parseFloat(e.target.value))} type="number" step="0.1" />
                            </div>
                        </PropRow>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-3 px-1">属性</div>
                    <PropRow label="名称">
                        <DarkInput value={selectedObject.name} onChange={(e) => updateObject(selectedObject.id, 'name', e.target.value)} className="text-left" />
                    </PropRow>
                    <PropRow label="颜色">
                        <div className="flex items-center gap-2 w-full justify-end">
                            <input type="color" value={selectedObject.color || '#ffffff'} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="bg-transparent border-none w-6 h-6 cursor-pointer" />
                            <span className="text-[10px] text-gray-400 font-mono">{selectedObject.color}</span>
                        </div>
                    </PropRow>
                    <PropRow label="不透明度">
                        <div className="flex items-center gap-2 w-full">
                            <input type="range" min="0" max="1" step="0.1" value={selectedObject.opacity || 1} onChange={(e) => updateObject(selectedObject.id, 'opacity', parseFloat(e.target.value))} className="flex-1 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" />
                            <span className="text-[10px] text-gray-400 w-6 text-right">{selectedObject.opacity || 1}</span>
                        </div>
                    </PropRow>
                </div>
            </div>
        </div>
    );
};

export default PropertiesPanel;
