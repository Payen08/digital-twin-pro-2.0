import React, { useState, useEffect, useCallback } from 'react';
import { Box, Play, Plus, Search, Edit3, Trash2, Globe, Clock, Loader2, FolderOpen } from 'lucide-react';
import { listAllProjects, deleteProject } from '../supabaseClient';

const HomePage = ({ onEnterWorkspace }) => {
    const [inputId, setInputId] = useState('');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState([]);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        try { setProjects(await listAllProjects()); } catch (e) {}
        setLoading(false);
    }, []);

    useEffect(() => { loadProjects(); }, [loadProjects]);
    useEffect(() => {
        try { const s = localStorage.getItem('dt-recent'); if (s) setRecent(JSON.parse(s)); } catch (e) {}
    }, []);

    const addRecent = (id) => {
        const u = [id, ...recent.filter(r => r !== id)].slice(0, 10);
        setRecent(u);
        localStorage.setItem('dt-recent', JSON.stringify(u));
    };

    const handleDelete = async (e, proj) => {
        e.stopPropagation();
        if (!confirm('删除方案 "' + (proj.project_name || proj.id) + '"？')) return;
        await deleteProject(proj.id);
        loadProjects();
    };

    return (
        <div className="min-h-screen bg-[#080808] text-gray-300">
            {/* Header */}
            <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
                            <Box size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">Digital Twin Pro</h1>
                            <p className="text-[10px] text-gray-600">数字孪生工作台</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Quick Actions */}
                <div className="flex gap-3 mb-8">
                    <div className="flex-1 flex gap-2">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                            <input
                                type="text" value={inputId}
                                onChange={e => setInputId(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && inputId.trim()) { addRecent(inputId.trim()); onEnterWorkspace(inputId.trim()); } }}
                                placeholder="输入工作区 ID 打开..."
                                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <button
                            onClick={() => { if (inputId.trim()) { addRecent(inputId.trim()); onEnterWorkspace(inputId.trim()); } }}
                            disabled={!inputId.trim()}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
                            <Play size={15} /> 打开
                        </button>
                    </div>
                    <button
                        onClick={() => { const id = 'ws-' + Math.random().toString(36).slice(2, 10); addRecent(id); onEnterWorkspace(id); }}
                        className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-gray-300 text-sm rounded-lg flex items-center gap-2">
                        <Plus size={15} /> 新建工作区
                    </button>
                    <button
                        onClick={() => onEnterWorkspace('')}
                        className="px-4 py-2.5 bg-transparent hover:bg-[#111] border border-[#1a1a1a] text-gray-500 text-sm rounded-lg">
                        离线
                    </button>
                </div>

                {/* Projects Table */}
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FolderOpen size={14} className="text-emerald-500" />
                            <span className="text-xs font-bold text-gray-300">全部方案</span>
                            {loading && <Loader2 size={12} className="animate-spin text-gray-600" />}
                        </div>
                        <span className="text-[10px] text-gray-600">{projects.length} 个项目</span>
                    </div>
                    {projects.length === 0 && !loading ? (
                        <div className="py-16 text-center">
                            <FolderOpen size={32} className="mx-auto text-gray-800 mb-3" />
                            <p className="text-sm text-gray-600">暂无方案</p>
                            <p className="text-[11px] text-gray-800 mt-1">创建新工作区开始使用</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#1a1a1a]">
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">方案名称</th>
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">工作区 ID</th>
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">更新时间</th>
                                    <th className="text-right px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map(p => (
                                    <tr key={p.id}
                                        onClick={() => { addRecent(p.workspace_id); onEnterWorkspace(p.workspace_id); }}
                                        className="border-b border-[#111] hover:bg-[#0f0f0f] cursor-pointer transition-colors group">
                                        <td className="px-5 py-3">
                                            <span className="text-sm text-gray-200 group-hover:text-white">{p.project_name || '未命名'}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <code className="text-[11px] text-gray-500 bg-[#111] px-1.5 py-0.5 rounded">{p.workspace_id}</code>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-[11px] text-gray-600">{new Date(p.updated_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button onClick={(e) => handleDelete(e, p)}
                                                className="p-1.5 rounded hover:bg-red-500/20 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Recent */}
                {recent.length > 0 && (
                    <div className="mt-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={14} className="text-gray-600" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase">最近打开</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recent.map(id => (
                                <button key={id} onClick={() => onEnterWorkspace(id)}
                                    className="px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-emerald-500/30 rounded-lg text-[11px] text-gray-400 hover:text-white font-mono transition-all">
                                    {id}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;
