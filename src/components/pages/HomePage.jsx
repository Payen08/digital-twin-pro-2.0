import React, { useState } from 'react';
import { Box, Plus, ArrowRight } from 'lucide-react';

const HomePage = ({ onEnterWorkspace }) => {
    const [inputId, setInputId] = useState('');

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center">
            <div className="w-full max-w-md px-6">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                        <Box size={30} className="text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Digital Twin Pro</h1>
                    <p className="text-xs text-gray-600 mt-1">数字孪生工作台</p>
                </div>
                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">工作区 ID</label>
                        <input type="text" value={inputId} onChange={e => setInputId(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && inputId.trim() && onEnterWorkspace(inputId.trim())}
                            placeholder="输入工作区 ID..." autoFocus
                            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <button onClick={() => inputId.trim() && onEnterWorkspace(inputId.trim())}
                        disabled={!inputId.trim()}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                        <ArrowRight size={16} /> 进入工作区
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[#1a1a1a]"></div>
                        <span className="text-[10px] text-gray-700">或</span>
                        <div className="flex-1 h-px bg-[#1a1a1a]"></div>
                    </div>
                    <button onClick={() => { const id = 'ws-' + Math.random().toString(36).slice(2, 10); onEnterWorkspace(id); }}
                        className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-300 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors">
                        <Plus size={15} /> 创建新工作区
                    </button>
                    <button onClick={() => onEnterWorkspace('')}
                        className="w-full py-2 bg-transparent hover:bg-[#111] text-gray-600 hover:text-gray-400 text-xs rounded-lg transition-colors">
                        离线使用
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
