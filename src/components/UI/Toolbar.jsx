import React from 'react';
import { MousePointer2, Spline, Move, RotateCw, Maximize2, Download, Undo2, Redo2 } from 'lucide-react';

const ToolBtn = ({ icon: Icon, active, onClick, title, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-lg transition-all ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-110'
            : 'text-gray-400 hover:text-white hover:bg-[#333]'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
        <Icon size={18} />
    </button>
);

const Toolbar = ({
    toolMode,
    setToolMode,
    transformMode,
    setTransformMode,
    setIsBoxSelecting,
    isEditingPoints,
    undo,
    redo,
    historyIndex,
    history
}) => {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-xl p-1 flex gap-1 shadow-2xl">
            <ToolBtn
                icon={MousePointer2}
                active={toolMode === 'select' && !transformMode && !isEditingPoints}
                onClick={() => { setToolMode('select'); setTransformMode(null); }}
                title="选择 (拖动框选)"
            />
            <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
            <ToolBtn
                icon={Spline}
                active={toolMode === 'draw_path'}
                onClick={() => { setToolMode('draw_path'); setTransformMode(null); }}
                title="绘制路径 (点击创建点/连接点)"
            />
            <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
            <ToolBtn
                icon={Move}
                active={toolMode === 'select' && transformMode === 'translate'}
                onClick={() => { setToolMode('select'); setTransformMode('translate'); setIsBoxSelecting(false); }}
                title="移动"
            />
            <ToolBtn
                icon={RotateCw}
                active={toolMode === 'select' && transformMode === 'rotate'}
                onClick={() => { setToolMode('select'); setTransformMode('rotate'); setIsBoxSelecting(false); }}
                title="旋转"
            />
            <ToolBtn
                icon={Maximize2}
                active={toolMode === 'select' && transformMode === 'scale'}
                onClick={() => { setToolMode('select'); setTransformMode('scale'); setIsBoxSelecting(false); }}
                title="缩放"
            />
            <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
            <ToolBtn
                icon={Download}
                onClick={() => { /* exportJSON */ }} // 这里需要在 App 中传入导出函数，或者暂时留空
                title="导出 JSON"
            />
            <div className="w-px h-5 bg-gray-700/50 mx-1 self-center"></div>
            <ToolBtn
                icon={Undo2}
                onClick={undo}
                disabled={historyIndex <= 0}
                title="撤销 (Ctrl+Z)"
            />
            <ToolBtn
                icon={Redo2}
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                title="重做 (Ctrl+Shift+Z)"
            />
        </div>
    );
};

export default Toolbar;
