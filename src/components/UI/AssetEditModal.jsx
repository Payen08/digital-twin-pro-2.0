import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

const AssetEditModal = ({ asset, onClose, onSave }) => {
    const [formData, setFormData] = useState({ ...asset });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'modelScale' || name === 'rotationY' ? parseFloat(value) : value
        }));
    };

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            <div className="bg-[#161616] w-[400px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <span className="text-sm font-bold text-white">编辑资产属性</span>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[11px] text-gray-400 block mb-1">资产名称</label>
                        <input
                            type="text"
                            name="label"
                            value={formData.label}
                            onChange={handleChange}
                            className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] text-gray-400 block mb-1">默认缩放</label>
                            <input
                                type="number"
                                name="modelScale"
                                value={formData.modelScale}
                                onChange={handleChange}
                                step="0.1"
                                className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] text-gray-400 block mb-1">默认旋转 (Y轴)</label>
                            <input
                                type="number"
                                name="rotationY"
                                value={formData.rotationY || 0}
                                onChange={handleChange}
                                className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs flex items-center gap-2"
                    >
                        <Save size={14} /> 保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssetEditModal;
