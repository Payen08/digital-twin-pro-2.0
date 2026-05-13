import React, { useState, useEffect, useCallback } from 'react';
import { Box, Plus, Trash2, FolderOpen, Loader2, ArrowLeft, LogOut, Play } from 'lucide-react';
import { listProjects, deleteProject } from '../../supabaseClient';

const ProjectsPage = ({ workspaceId, onOpenProject, onBack }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try { setProjects(await listProjects(workspaceId)); } catch (e) {}
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = () => {
        const name = newName.trim() || ('方案 ' + (projects.length + 1));
        onOpenProject(workspaceId, name);
    };

    const handleDelete = async (e, proj) => {
        e.stopPropagation();
        if (!confirm('删除"' + (proj.project_name || proj.id) + '"？')) return;
        await deleteProject(proj.id);
        load();
    };

    return (
        <div className="min-h-screen bg-[#080808] text-gray-300">
            <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-1.5 rounded hover:bg-[#1a1a1a] text-gray-500 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
                                <Box size={13} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">工作区</p>
                                <code className="text-[11px] text-gray-300 font-mono">{workspaceId}</code>
                            </div>
                        </div>
                    </div>
                    <button onClick={onBack} className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1">
                        <LogOut size={12} /> 切换工作区
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <FolderOpen size={16} className="text-blue-400" />
                        <h2 className="text-sm font-bold text-white">孪生方案</h2>
                        <span className="text-[10px] text-gray-600 ml-1">{projects.length} 个</span>
                    </div>
                </div>

                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 mb-6">
                    <div className="flex gap-2">
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="输入方案名称..."
                            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500" />
                        <button onClick={handleCreate}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                            <Plus size={15} /> 新建方案
                        </button>
                    </div>
                </div>

                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
                    {loading && (
                        <div className="py-12 text-center">
                            <Loader2 size={20} className="animate-spin mx-auto text-gray-700 mb-2" />
                            <p className="text-xs text-gray-700">加载中...</p>
                        </div>
                    )}
                    {!loading && projects.length === 0 && (
                        <div className="py-16 text-center">
                            <FolderOpen size={32} className="mx-auto text-gray-800 mb-3" />
                            <p className="text-sm text-gray-600">暂无方案</p>
                            <p className="text-[11px] text-gray-800 mt-1">输入名称创建第一个孪生方案</p>
                        </div>
                    )}
                    {!loading && projects.length > 0 && (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#1a1a1a]">
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase w-12">#</th>
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">方案名称</th>
                                    <th className="text-left px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">更新时间</th>
                                    <th className="text-right px-5 py-2.5 text-[10px] font-medium text-gray-600 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p, i) => (
                                    <tr key={p.id}
                                        onClick={() => onOpenProject(workspaceId, p.project_name, p.id)}
                                        className="border-b border-[#111] hover:bg-[#0f0f0f] cursor-pointer transition-colors group">
                                        <td className="px-5 py-3 text-[11px] text-gray-700">{i + 1}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <FolderOpen size={14} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                                                <span className="text-sm text-gray-200 group-hover:text-white">{p.project_name || '未命名'}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-[11px] text-gray-600">
                                                {new Date(p.updated_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="p-1.5 rounded hover:bg-blue-500/20 text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" title="编辑">
                                                    <Play size={13} />
                                                </button>
                                                <button onClick={(e) => handleDelete(e, p)}
                                                    className="p-1.5 rounded hover:bg-red-500/20 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="删除">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectsPage;
