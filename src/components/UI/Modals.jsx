import React from 'react';
import { X, Map as MapIcon, Check, Upload } from 'lucide-react';
import { builtInMapTemplates } from '../../data/builtInMaps';

export const MapSelectorModal = ({ onClose, onSelect, selectedTemplateId, setSelectedTemplateId }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
            <div className="bg-[#161616] w-[600px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                        <MapIcon size={18} className="text-green-400" />
                        <span className="text-sm font-bold text-white">选择内置地图</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-3">
                    {builtInMapTemplates.map(template => (
                        <div
                            key={template.id}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedTemplateId === template.id
                                ? 'border-green-500 bg-green-900/20'
                                : 'border-[#333] bg-[#0f0f0f] hover:border-green-500/50'
                                }`}
                            onClick={() => setSelectedTemplateId(template.id)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-white mb-1">{template.name}</h3>
                                    <p className="text-[11px] text-gray-400">{template.description}</p>
                                </div>
                                {selectedTemplateId === template.id && (
                                    <Check size={18} className="text-green-400" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-[#2a2a2a] flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#222] text-gray-300 rounded hover:bg-[#333] text-xs"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => selectedTemplateId && onSelect(selectedTemplateId)}
                        disabled={!selectedTemplateId}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded hover:from-green-700 hover:to-emerald-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        加载地图
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SLAMUploadModal = ({ onClose, onUpload, yamlInputRef, imageInputRef }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
            <div className="bg-[#161616] w-[500px] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                    <span className="text-sm font-bold text-white">上传 SLAM 地图</span>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[11px] text-gray-400 block mb-2">YAML 配置文件 (.yaml)</label>
                        <input
                            ref={yamlInputRef}
                            type="file"
                            accept=".yaml,.yml"
                            className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] text-gray-400 block mb-2">地图图片 (.png, .pgm)</label>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept=".png,.pgm,.jpg,.jpeg"
                            className="w-full bg-[#0f0f0f] border border-[#333] rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="bg-blue-900/20 border border-blue-800/50 rounded p-3">
                        <p className="text-[10px] text-blue-300">
                            <strong>提示：</strong> YAML 文件应包含 resolution 和 origin 参数。上传后将自动替换现有底图。
                        </p>
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
                        onClick={onUpload}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded hover:from-blue-700 hover:to-purple-700 text-xs"
                    >
                        开始处理
                    </button>
                </div>
            </div>
        </div>
    );
};
