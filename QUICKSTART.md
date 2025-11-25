# 快速启动指南

## 第一次运行

### 1. 安装依赖（首次运行必须）

\`\`\`bash
cd digital-twin-pro
npm install
\`\`\`

这会安装所有必要的依赖包，大约需要1-2分钟。

### 2. 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

浏览器会自动打开 `http://localhost:3000`

## 日常开发

每次开发时只需运行：

\`\`\`bash
cd digital-twin-pro
npm run dev
\`\`\`

## 常见问题

### Q: 提示找不到模块？
A: 运行 `npm install` 安装依赖

### Q: 端口被占用？
A: 修改 `vite.config.js` 中的 `port` 配置

### Q: 如何停止服务器？
A: 在终端按 `Ctrl + C`

## 下一步

项目已经创建好基础结构，你可以：

1. 将原HTML文件中的组件逐步迁移到 `src/components/` 目录
2. 在 `src/data/` 中添加更多地图数据
3. 在 `public/` 目录放置3D模型文件（如 cnc.glb）

## 项目优势

相比单个HTML文件：

✅ **代码组织更清晰** - 每个组件独立文件
✅ **开发体验更好** - 热更新、代码提示
✅ **性能更优** - Vite构建优化
✅ **易于维护** - 模块化结构
✅ **团队协作友好** - Git版本控制
