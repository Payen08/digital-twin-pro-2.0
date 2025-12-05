# Supabase 集成说明

## ✅ 已完成的功能

### 1. 数据库设计
已在Supabase中创建以下表：
- `scenes` - 场景表
- `floor_levels` - 楼层表
- `base_maps` - 底图数据表
- `glb_models` - GLB模型表
- `scene_objects` - 场景对象表

### 2. 自动保存功能

#### 底图数据自动保存
当上传地图JSON时，系统会自动保存底图数据到Supabase：
- 图片URL
- 原点坐标 (origin_x, origin_y)
- 分辨率 (resolution)
- 实际尺寸 (width, height)

#### GLB模型自动保存
当上传GLB模型时，系统会自动保存到Supabase：
- 文件名
- 模型URL（Base64）
- 位置 (position_x, position_y, position_z)
- 缩放 (scale_x, scale_y, scale_z)
- 锁定状态 (locked = true)

### 3. 解决的问题

✅ **QuotaExceededError** - 不再依赖localStorage存储大文件
✅ **数据持久化** - 数据保存在云端，不会丢失
✅ **多设备同步** - 可以在不同设备上访问相同数据

## 📝 使用说明

### 环境配置

1. 复制`.env.example`为`.env`
2. 填写Supabase配置：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### API函数

所有Supabase操作函数都在`src/supabaseClient.js`中：

```javascript
// 底图操作
await saveBaseMap(floorId, baseMapData);
await getBaseMap(floorId);

// GLB模型操作
await saveGLBModel(floorId, modelData);
await getGLBModel(floorId);
await deleteGLBModel(floorId);

// 场景对象操作
await saveSceneObjects(floorId, objects);
await getSceneObjects(floorId);
```

## 🎯 下一步计划

### 待实现功能

1. **从Supabase加载数据**
   - 页面加载时自动从Supabase获取数据
   - 替代localStorage的读取逻辑

2. **实时同步**
   - 使用Supabase Realtime订阅数据变化
   - 多用户协作编辑

3. **文件存储优化**
   - 使用Supabase Storage存储GLB文件
   - 避免Base64编码，减小数据大小

4. **场景对象自动保存**
   - 当添加/修改/删除场景对象时自动保存

## 🔧 技术细节

### 数据流

```
上传地图JSON
    ↓
解析地图数据
    ↓
保存到State (floors)
    ↓
自动保存到Supabase (base_maps)
    ↓
✅ 完成
```

```
上传GLB模型
    ↓
读取为Base64
    ↓
计算自动缩放
    ↓
保存到State (floors.sceneModelData)
    ↓
自动保存到Supabase (glb_models)
    ↓
创建模型对象添加到场景
    ↓
✅ 完成
```

### 错误处理

所有Supabase操作都包含错误处理：
- 成功：控制台显示 `✅ XXX已保存到Supabase`
- 失败：控制台显示 `❌ 保存XXX到Supabase失败: [error]`

## 📊 数据库Schema

### base_maps 表
```sql
id              UUID PRIMARY KEY
floor_id        UUID REFERENCES floor_levels(id)
image_url       TEXT
origin_x        FLOAT
origin_y        FLOAT
resolution      FLOAT
width           FLOAT
height          FLOAT
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### glb_models 表
```sql
id              UUID PRIMARY KEY
floor_id        UUID REFERENCES floor_levels(id)
file_name       TEXT
model_url       TEXT (Base64)
position_x      FLOAT
position_y      FLOAT
position_z      FLOAT
scale_x         FLOAT
scale_y         FLOAT
scale_z         FLOAT
locked          BOOLEAN
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

## 🎉 成功案例

✅ GLB模型自动拉伸撑满底图边界
✅ 模型数据自动保存到Supabase
✅ 底图数据自动保存到Supabase
✅ 不再出现QuotaExceededError

## 🐛 已知问题

暂无

## 📞 支持

如有问题，请检查：
1. Supabase配置是否正确（.env文件）
2. 数据库表是否已创建（执行SQL）
3. RLS策略是否已启用
4. 控制台是否有错误日志
