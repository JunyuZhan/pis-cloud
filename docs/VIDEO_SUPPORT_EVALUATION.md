# 视频上传支持评估

> 更新时间: 2026-01-26

## 📊 当前状态

### ❌ 不支持视频上传

**当前限制**:

1. **前端验证** (`apps/web/src/app/api/admin/albums/[id]/upload/route.ts:101`)
   ```typescript
   const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
   // ❌ 只允许图片类型
   ```

2. **前端组件** (`photo-uploader.tsx:129`)
   ```typescript
   const isValidType = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'].includes(file.type)
   // ❌ 只允许图片类型
   ```

3. **Worker 处理** (`services/worker/src/index.ts`)
   - 使用 `Sharp` 库（只支持图片）
   - 处理流程：下载 → Sharp 处理 → 生成缩略图/预览图
   - ❌ 不支持视频处理

4. **扫描功能** (`services/worker/src/index.ts:867`)
   ```typescript
   const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp'];
   // ❌ 只扫描图片文件
   ```

5. **数据库 Schema** (`database/full_schema.sql`)
   - `photos` 表设计用于照片
   - 字段：`width`, `height`, `blur_data`（图片特有）
   - ❌ 没有视频相关字段（时长、分辨率、格式等）

---

## 🎯 如果要支持视频，需要做什么？

### 方案1: 简单支持（仅上传和播放）

**功能**: 只上传视频，不处理，直接播放

**需要修改**:

1. **前端验证** (2处)
   ```typescript
   // 添加视频类型
   const allowedTypes = [
     'image/jpeg', 'image/png', 'image/heic', 'image/webp',
     'video/mp4', 'video/quicktime', 'video/x-msvideo' // 新增
   ]
   ```

2. **数据库 Schema**
   ```sql
   -- 添加媒体类型字段
   ALTER TABLE photos ADD COLUMN media_type TEXT DEFAULT 'image' 
     CHECK (media_type IN ('image', 'video'));
   
   -- 添加视频相关字段
   ALTER TABLE photos ADD COLUMN duration INTEGER; -- 时长（秒）
   ALTER TABLE photos ADD COLUMN video_codec TEXT;
   ```

3. **Worker 处理逻辑**
   ```typescript
   // 跳过视频处理，直接标记为 completed
   if (mimeType.startsWith('video/')) {
     await supabase.from('photos').update({ 
       status: 'completed',
       media_type: 'video'
     });
     return; // 不处理
   }
   ```

**优势**:
- ✅ 实现简单（1-2天）
- ✅ 不影响现有图片处理

**劣势**:
- ❌ 没有视频缩略图
- ❌ 没有视频转码
- ❌ 前端需要支持视频播放

---

### 方案2: 完整支持（上传 + 处理）

**功能**: 上传视频，生成缩略图，可选转码

**需要修改**:

1. **所有方案1的修改** ✅

2. **添加视频处理库**
   ```bash
   # 安装 ffmpeg
   # Dockerfile 中需要安装 ffmpeg
   ```

3. **创建 VideoProcessor 类**
   ```typescript
   // services/worker/src/video-processor.ts
   import ffmpeg from 'fluent-ffmpeg';
   
   export class VideoProcessor {
     async process(videoBuffer: Buffer): Promise<{
       thumbnail: Buffer;
       duration: number;
       metadata: any;
     }> {
       // 使用 ffmpeg 处理视频
     }
   }
   ```

4. **修改 Worker 处理逻辑**
   ```typescript
   // 检测文件类型
   if (mimeType.startsWith('video/')) {
     const processor = new VideoProcessor();
     const result = await processor.process(originalBuffer);
     // 生成缩略图、提取元数据等
   } else {
     // 现有的图片处理逻辑
   }
   ```

5. **添加视频处理队列**
   ```typescript
   const videoWorker = new Worker('video-processing', ...);
   ```

**优势**:
- ✅ 完整的视频支持
- ✅ 生成视频缩略图
- ✅ 提取视频元数据

**劣势**:
- ❌ 开发工作量大（2-3周）
- ❌ 资源消耗大（CPU、内存）
- ❌ 需要安装 ffmpeg（Docker 镜像变大）

---

## 📊 对比分析

| 方案 | 开发工作量 | 资源消耗 | 功能完整性 | 推荐度 |
|------|-----------|---------|-----------|--------|
| 方案1: 简单支持 | 1-2天 | 低 | ⭐ | ⭐⭐ |
| 方案2: 完整支持 | 2-3周 | 高 | ⭐⭐⭐ | ⭐ |

---

## 🎯 建议

### 当前建议: ❌ 暂不支持视频

**理由**:
1. **PIS 定位**: 照片分享系统，不是视频平台
2. **资源消耗**: 视频处理需要大量 CPU 和内存
3. **开发成本**: 完整支持需要大量开发工作
4. **维护成本**: 视频处理复杂，容易出问题

### 如果确实需要支持视频

**推荐方案**: 方案1（简单支持）

**实施步骤**:
1. 修改前端验证，允许视频类型
2. 修改数据库 schema，添加媒体类型字段
3. Worker 跳过视频处理，直接标记为 completed
4. 前端添加视频播放器（使用 HTML5 video 标签）

**预期工作量**: 1-2天

---

## 📝 总结

### 当前状态
- ❌ **不支持视频上传**
- ✅ 只支持图片（JPEG、PNG、HEIC、WebP）

### 如果要支持视频
- **简单方案**: 1-2天（仅上传和播放）
- **完整方案**: 2-3周（上传 + 处理 + 转码）

### 建议
- **暂不支持视频**（保持系统简洁）
- 如果确实需要，优先考虑**简单方案**

---

## 🔗 相关文档

- [Worker 功能清单](./WORKER_FEATURES.md)
