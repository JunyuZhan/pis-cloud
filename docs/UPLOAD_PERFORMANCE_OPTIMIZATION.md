# 大文件上传性能优化方案

> 更新时间: 2026-01-26

## 📊 当前上传机制分析

### 当前实现

#### 1. 直接上传（PUT /api/upload）

**流程**:
```
浏览器 → Next.js API (流式转发) → Worker API → 内存缓冲 → MinIO
```

**代码位置**: `services/worker/src/index.ts:604-645`

**问题**:
```typescript
const chunks: Buffer[] = [];
let uploadSize = 0;

req.on('data', (chunk: Buffer) => {
  uploadSize += chunk.length;
  if (uploadSize > MAX_UPLOAD_SIZE) {
    // 拒绝
  }
  chunks.push(chunk); // ⚠️ 所有数据都加载到内存
});

req.on('end', async () => {
  const buffer = Buffer.concat(chunks); // ⚠️ 创建完整文件 buffer
  await uploadFile(key, buffer, ...); // ⚠️ 上传完整文件
});
```

**性能问题**:
- ❌ 整个文件加载到内存（最大 500MB）
- ❌ 内存占用 = 文件大小 × 2（接收 + 上传）
- ❌ 大文件可能导致内存溢出
- ❌ 上传失败需要重新上传整个文件

---

#### 2. 分片上传（Multipart Upload）

**流程**:
```
浏览器 → 初始化 → 上传分片1 → 上传分片2 → ... → 完成上传
```

**代码位置**: `services/worker/src/index.ts:715-842`

**优点**:
- ✅ 支持大文件（理论上无限制）
- ✅ 可以断点续传
- ✅ 并行上传多个分片

**当前限制**:
- ⚠️ 分片大小固定（需要前端配置）
- ⚠️ 前端可能没有使用分片上传

---

## 🚀 优化方案

### 方案1: 流式上传（推荐，立即实施）

**优化思路**: 不将整个文件加载到内存，而是流式传输到存储

**实现**:
```typescript
// 优化后的代码
if (url.pathname === '/api/upload' && req.method === 'PUT') {
  const key = url.searchParams.get('key');
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  
  if (!key) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing key parameter' }));
    return;
  }

  let uploadSize = 0;
  let uploadStream: NodeJS.WritableStream | null = null;
  
  try {
    // 创建流式上传（不加载到内存）
    uploadStream = await createUploadStream(key, contentType);
    
    req.on('data', (chunk: Buffer) => {
      uploadSize += chunk.length;
      if (uploadSize > MAX_UPLOAD_SIZE) {
        req.destroy();
        uploadStream?.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `File too large (max: ${MAX_UPLOAD_SIZE} bytes)` }));
        return;
      }
      uploadStream?.write(chunk); // 直接写入流，不缓冲
    });
    
    req.on('end', async () => {
      try {
        uploadStream?.end();
        await uploadStream; // 等待上传完成
        
        console.log(`[Upload] Successfully uploaded ${uploadSize} bytes: ${key}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, key }));
      } catch (err: any) {
        console.error('Upload error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    
    req.on('error', (err) => {
      uploadStream?.destroy();
      console.error('Request error:', err);
    });
  } catch (err: any) {
    uploadStream?.destroy();
    console.error('Upload stream error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
  return;
}
```

**需要实现**: `createUploadStream` 函数（流式上传到 MinIO/S3）

**预期提升**:
- ✅ 内存占用减少 90%+（只缓冲小部分数据）
- ✅ 支持更大的文件（不受内存限制）
- ✅ 上传速度提升（无需等待完整文件）

---

### 方案2: 自动分片上传（大文件自动切换）

**优化思路**: 小文件直接上传，大文件自动使用分片上传

**实现**:
```typescript
// 前端自动选择上传方式
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB 分片
const DIRECT_UPLOAD_MAX = 50 * 1024 * 1024; // 50MB 以下直接上传

async function uploadFile(file: File, key: string) {
  if (file.size <= DIRECT_UPLOAD_MAX) {
    // 小文件：直接上传
    return await directUpload(file, key);
  } else {
    // 大文件：分片上传
    return await multipartUpload(file, key);
  }
}

async function multipartUpload(file: File, key: string) {
  // 1. 初始化上传
  const { uploadId } = await initMultipartUpload(key);
  
  // 2. 并行上传分片（每批 3 个）
  const chunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);
  const parts: Array<{ partNumber: number; etag: string }> = [];
  
  const batchSize = 3; // 每批 3 个分片
  for (let i = 0; i < chunks; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, chunks); j++) {
      const start = j * UPLOAD_CHUNK_SIZE;
      const end = Math.min(start + UPLOAD_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      batch.push(
        uploadPart(key, uploadId, j + 1, chunk).then(etag => ({
          partNumber: j + 1,
          etag
        }))
      );
    }
    
    const batchResults = await Promise.all(batch);
    parts.push(...batchResults);
  }
  
  // 3. 完成上传
  return await completeMultipartUpload(key, uploadId, parts);
}
```

**预期提升**:
- ✅ 小文件快速上传（无额外开销）
- ✅ 大文件稳定上传（分片 + 并行）
- ✅ 支持断点续传

---

### 方案3: 前端优化（并行上传多个文件）

**优化思路**: 同时上传多个文件，而不是串行

**当前实现**（可能）:
```typescript
// 串行上传
for (const file of files) {
  await uploadFile(file); // 等待一个完成再上传下一个
}
```

**优化后**:
```typescript
// 并行上传（每批 3 个）
const batchSize = 3;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await Promise.all(batch.map(file => uploadFile(file)));
}
```

**预期提升**:
- ✅ 上传 10 个文件：从 ~100秒 减少到 ~35秒
- ✅ 提升约 65%

---

## 📈 性能对比

### 当前实现（直接上传）

| 文件大小 | 内存占用 | 上传时间 | 问题 |
|---------|---------|---------|------|
| 10MB | ~20MB | ~2秒 | ✅ 正常 |
| 50MB | ~100MB | ~10秒 | ⚠️ 内存占用高 |
| 100MB | ~200MB | ~20秒 | ⚠️ 内存占用高 |
| 500MB | ~1GB | ~100秒 | ❌ 可能内存溢出 |

### 优化后（流式上传）

| 文件大小 | 内存占用 | 上传时间 | 优势 |
|---------|---------|---------|------|
| 10MB | ~2MB | ~2秒 | ✅ 内存减少 90% |
| 50MB | ~2MB | ~10秒 | ✅ 内存减少 98% |
| 100MB | ~2MB | ~20秒 | ✅ 内存减少 99% |
| 500MB | ~2MB | ~100秒 | ✅ 内存减少 99.6% |

---

## 🎯 实施优先级

### 高优先级（立即实施）

1. **流式上传优化** ⭐⭐⭐
   - 预期提升: 内存减少 90%+
   - 实现难度: 中
   - 风险: 低
   - 影响: 所有文件上传

### 中优先级（建议实施）

2. **自动分片上传** ⭐⭐
   - 预期提升: 大文件稳定上传
   - 实现难度: 中
   - 风险: 低
   - 影响: 大文件上传（>50MB）

3. **前端并行上传** ⭐⭐
   - 预期提升: 多文件上传速度提升 65%
   - 实现难度: 低
   - 风险: 低
   - 影响: 批量上传

---

## 🔧 实施步骤

### 步骤1: 实现流式上传（Worker）

1. 在 `lib/storage/index.ts` 中添加 `createUploadStream` 函数
2. 修改 `services/worker/src/index.ts:604-645` 使用流式上传
3. 测试小文件和大文件上传

### 步骤2: 前端自动分片上传

1. 修改 `apps/web/src/components/admin/photo-uploader.tsx`
2. 添加文件大小检测
3. 大文件自动使用分片上传

### 步骤3: 前端并行上传

1. 修改批量上传逻辑
2. 添加并发控制（每批 3 个）
3. 添加进度显示

---

## 📊 监控指标

### 关键指标

1. **内存使用**
   ```bash
   docker stats pis-worker --no-stream | grep MEM
   ```
   - 正常: < 100MB
   - 警告: 100-200MB
   - 严重: > 200MB

2. **上传速度**
   - 小文件（<10MB）: 目标 > 5MB/s
   - 大文件（>50MB）: 目标 > 3MB/s

3. **上传成功率**
   ```bash
   docker logs pis-worker | grep -c "Successfully uploaded"
   ```
   - 正常: > 99%
   - 警告: 95-99%
   - 严重: < 95%

---

## 📝 总结

### 实际使用场景

**照片大小**: 最多几十MB（如 10-50MB）

### 当前实现评估

对于几十MB的照片：
- ✅ **内存占用**: ~100MB（50MB × 2），**可接受**
- ✅ **上传速度**: 正常（10-20秒）
- ✅ **稳定性**: 良好
- ⚠️ **文件大小限制**: 500MB 过于宽松，建议调整为 100MB

### 优化方案（按实际需求）

#### 1. 调整文件大小限制（建议立即实施）
- 将 `MAX_UPLOAD_SIZE` 从 500MB 调整为 100MB
- 前端验证也调整为 100MB
- **理由**: 照片最多几十MB，500MB 限制过于宽松

#### 2. 流式上传优化（可选，低优先级）
- 对于几十MB文件，当前内存占用可接受
- 如果未来需要支持更大文件（>100MB），再实施
- **预期提升**: 内存减少 90%+（但当前场景下收益有限）

#### 3. 自动分片上传（可选，低优先级）
- 几十MB文件直接上传即可
- 如果未来需要支持超大文件（>100MB），再实施
- **预期提升**: 大文件稳定上传 + 断点续传

#### 4. 并行上传（已完成）
- ✅ 前端已实现（MAX_CONCURRENT_UPLOADS = 3）

### 建议

**立即实施**: 
1. ⭐⭐⭐ **调整文件大小限制** - 500MB → 100MB（符合实际使用场景）

**可选实施**（如果未来需要支持更大文件）:
2. ⭐ 流式上传优化
3. ⭐ 自动分片上传

---

## 🔗 相关文档

- [上传协调机制](./UPLOAD_COORDINATION.md)
- [Worker 性能分析](./WORKER_PERFORMANCE_ANALYSIS.md)
- [Worker 深度审计](./WORKER_DEEP_AUDIT.md)
