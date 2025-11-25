# UI 优化 - 隐藏收起按钮

## ✅ 已完成

隐藏了右上角的面板收起/展开按钮（PanelRightClose / PanelRight 图标）

## 📍 修改位置

**文件**: `src/App.jsx`
**行数**: 4435-4443

## 🔧 修改内容

### 修改前
```jsx
{!isPreviewMode && (
    <button
        onClick={() => setIsPanelVisible(!isPanelVisible)}
        className="glass-panel p-1.5 bg-[#080808] rounded-lg..."
        title={isPanelVisible ? "隐藏属性面板" : "显示属性面板"}
    >
        {isPanelVisible ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
    </button>
)}
<button onClick={() => setIsPreviewMode(!isPreviewMode)} ...>
```

### 修改后
```jsx
<button onClick={() => setIsPreviewMode(!isPreviewMode)} ...>
```

## 🎯 效果

- ✅ 右上角不再显示收起/展开按钮
- ✅ 属性面板始终显示
- ✅ 只保留 2D/3D 切换和预览按钮

## 💡 如果需要恢复

如果以后需要恢复这个按钮，只需要在预览按钮前添加：

```jsx
{!isPreviewMode && (
    <button
        onClick={() => setIsPanelVisible(!isPanelVisible)}
        className={`glass-panel p-1.5 bg-[#080808] rounded-lg transition-colors ${isPanelVisible ? 'text-blue-400 hover:text-blue-300' : 'text-gray-400 hover:text-white'}`}
        title={isPanelVisible ? "隐藏属性面板" : "显示属性面板"}
    >
        {isPanelVisible ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
    </button>
)}
```

## 📊 现在的右上角按钮

1. **2D/3D 切换** - 切换视图模式
2. **预览按钮** - 进入/退出预览模式

收起按钮已隐藏！
