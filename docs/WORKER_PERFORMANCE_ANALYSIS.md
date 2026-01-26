# Worker 性能分析报告

> 更新时间: 2026-01-26

## 📊 当前状态

### 资源使用情况
- **CPU**: 0.02%（非常低）
- **内存**: 54.09MiB / 7.253GiB (0.73%，很低)
- **队列状态**: 无积压（等待/活跃/完成/失败均为 0）
- **错误日志**: 无错误或警告

### 配置参数
- **照片处理并发数**: 5
- **打包任务并发数**: 2
- **限流器**: 10 任务/秒

---

## ✅ 性能优点

1. **资源使用高效**
   - CPU 和内存使用率都很低
   - 没有资源泄漏迹象

2. **并行处理**
   - 使用 `Promise.all` 并行上传缩略图和预览图
   - 使用 `Promise.all` 处理多部分上传

3. **错误处理完善**
   - 有完善的错误处理和重试机制
   - 对文件不存在等情况有优雅降级

4. **队列管理**
   - 使用 BullMQ 进行任务队列管理
   - 有并发控制和限流机制

---

## ⚠️ 潜在性能问题

### 1. ✅ 水印处理并行化（已优化）

**问题位置**: `services/worker/src/processor.ts:175-197`

**原问题**: 多个水印串行处理，每个水印等待前一个完成

**优化方案**: 已改为并行处理
```typescript
// 优化后：并行处理多个水印
const enabledWatermarks = watermarkConfig.watermarks.filter(w => w.enabled !== false);
const watermarkPromises = enabledWatermarks.map(watermark =>
  this.createWatermarkBuffer(watermark, width, height)
);
const watermarkBuffers = await Promise.all(watermarkPromises);
```

**性能提升**: ✅ 已完成优化
- 如果有 3 个水印，处理时间减少约 60-70%
- 如果有 6 个水印，处理时间减少约 80-85%

**提交**: `perf(worker): 优化水印处理为并行处理` (2026-01-26)

---

### 2. 并发数可能偏低（低优先级）

**当前配置**: 
- 照片处理: `concurrency: 5`
- 打包任务: `concurrency: 2`

**分析**:
- CPU 使用率仅 0.02%，说明有大量空闲资源
- 内存使用率仅 0.73%，内存充足
- 队列无积压，说明当前并发数足够

**建议**:
- **当前阶段**: 保持现有配置（因为队列无积压）
- **如果出现积压**: 可以逐步增加到 `concurrency: 8-10`
- **监控指标**: 关注 CPU 和内存使用率，如果都低于 50%，可以增加并发

---

### 3. 扫描 API 串行处理（低优先级）

**问题位置**: `services/worker/src/index.ts:900-944`

```typescript
// 当前实现：串行处理每个图片
for (const obj of imageObjects) {
  // ... 处理逻辑
  await copyFile(obj.key, newKey);
  await supabase.from('photos').insert(...);
  await photoQueue.add(...);
}
```

**影响**: 如果扫描大量图片（如 100 张），会串行处理，耗时较长。

**建议优化**:
```typescript
// 批量处理（每批 10 个）
const batchSize = 10;
for (let i = 0; i < imageObjects.length; i += batchSize) {
  const batch = imageObjects.slice(i, i + batchSize);
  await Promise.all(batch.map(obj => processImage(obj)));
}
```

**预期提升**: 如果扫描 100 张图片，处理时间可减少约 80-90%。

---

### 4. 数据库查询优化（低优先级）

**当前实现**: 每个任务都有多次数据库查询
- 检查照片是否存在
- 更新状态为 processing
- 获取照片旋转角度
- 获取相册水印配置
- 更新最终状态

**建议**: 
- 合并部分查询（如一次性获取照片和相册信息）
- 使用数据库连接池（Supabase 已自动管理）

---

## 📈 性能监控建议

### 关键指标

1. **队列长度**
   ```bash
   docker exec pis-redis redis-cli LLEN bull:photo-processing:waiting
   ```
   - 如果持续 > 10，考虑增加并发数

2. **处理时间**
   - 监控日志中的 `[job.id] Process`、`[job.id] Download`、`[job.id] Upload` 时间
   - 如果平均处理时间 > 5 秒，需要优化

3. **资源使用**
   ```bash
   docker stats pis-worker --no-stream
   ```
   - CPU > 80%: 可能需要减少并发
   - 内存 > 80%: 需要检查内存泄漏

4. **错误率**
   ```bash
   docker logs pis-worker | grep -c "❌"
   ```
   - 如果错误率 > 5%，需要检查错误原因

---

## 🎯 优化优先级

### 高优先级（立即优化）
- ✅ **无** - 当前性能良好，无紧急问题

### 中优先级（建议优化）
1. ✅ **水印并行处理** - 已完成优化 (2026-01-26)
   - 预期提升: 60-70% 处理时间减少
   - 实现难度: 低
   - 风险: 低

### 低优先级（可选优化）
1. **扫描 API 批量处理** - 如果经常扫描大量图片
2. **增加并发数** - 如果出现队列积压
3. **数据库查询优化** - 如果处理时间过长

---

## 🔍 性能测试建议

### 压力测试
```bash
# 1. 创建测试任务
for i in {1..50}; do
  curl -X POST http://worker.albertzhan.top/api/process \
    -H "Content-Type: application/json" \
    -H "X-API-Key: YOUR_KEY" \
    -d "{\"photoId\":\"test-$i\",\"albumId\":\"test\",\"originalKey\":\"test.jpg\"}"
done

# 2. 监控队列
watch -n 1 'docker exec pis-redis redis-cli LLEN bull:photo-processing:waiting'

# 3. 监控资源
watch -n 1 'docker stats pis-worker --no-stream'
```

### 基准测试
- **单张照片处理时间**: 目标 < 3 秒
- **并发处理能力**: 目标 5-10 张/秒
- **内存使用**: 目标 < 200MB

---

## 📝 总结

### 当前状态: ✅ 良好

Worker 服务当前性能表现良好：
- ✅ 资源使用率低
- ✅ 无队列积压
- ✅ 无错误日志
- ✅ 响应速度快

### 建议行动

1. **短期（1-2周）**:
   - 继续监控队列和资源使用
   - 如果出现积压，考虑增加并发数

2. **中期（1-2月）**:
   - 如果经常使用多个水印，优化水印并行处理
   - 如果经常扫描大量图片，优化扫描 API

3. **长期（3-6月）**:
   - 根据实际使用情况调整并发数
   - 考虑添加性能监控和告警

---

## 🔗 相关文档

- [Worker 深度审计](./WORKER_DEEP_AUDIT.md)
- [Worker 安全修复](./WORKER_SECURITY_FIX.md)
- [Worker API Key 设置](./WORKER_API_KEY_SETUP.md)
