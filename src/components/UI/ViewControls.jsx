import React from 'react';
import { Box, Square, Columns } from 'lucide-react'; // 使用近似图标

const ViewBtn = ({ active, onClick, label, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${
            active ? 'bg-blue-600 text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]'
        }`}
    >
        <Icon size={14} />
        {label}
    </button>
);

const ViewControls = ({ viewMode, setViewMode, cameraView, setCameraView }) => {
    return (
        <div className="absolute top-4 right-4 z-20 flex gap-2">
            <div className="flex bg-[#09090b] p-1 rounded-lg border border-[#333]">
                <ViewBtn 
                    active={cameraView === 'perspective'} 
                    onClick={() => setCameraView('perspective')} 
                    label="透视" 
                    icon={Box}
                />
                <ViewBtn 
                    active={cameraView === 'top'} 
                    onClick={() => setCameraView('top')} 
                    label="顶视" 
                    icon={Square}
                />
                <ViewBtn 
                    active={cameraView === 'front'} 
                    onClick={() => setCameraView('front')} 
                    label="正视" 
                    icon={Columns}
                />
            </div>
        </div>
    );
};

export default ViewControls;
