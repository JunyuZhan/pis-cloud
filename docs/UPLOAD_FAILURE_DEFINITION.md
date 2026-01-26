# 上传失败定义和处理机制

## 上传失败的定义

### 1. 获取凭证失败

**触发时机**：调用 `/api/admin/albums/[id]/upload` 失败

**失败判断**：
- HTTP 状态码不在 200-299 范围内
- 响应中包含 `error` 字段
- 响应中缺少 `uploadUrl` 字段

**处理逻辑**：
1. 如果响应中包含 `photoId`（说明数据库记录已创建），尝试清理
2. 如果清理失败，延迟 2 秒后调用 `check-pending` API

**代码位置**：`photo-uploader.tsx` 第 582-623 行

### 2. 文件上传失败

**触发时机**：使用 presigned URL 上传文件到 MinIO 时失败

**失败判断**：

#### 2.1 HTTP 状态码错误
- `xhr.onload` 中：`xhr.status < 200 || xhr.status >= 300`
- 例如：400 Bad Request, 403 Forbidden, 500 Internal Server Error

#### 2.2 网络错误
- `xhr.onerror`：网络连接中断、DNS 解析失败等
- 判断条件：`xhr.status === 0 || xhr.readyState === 0`

#### 2.3 上传超时
- `xhr.ontimeout`：超过动态计算的超时时间
- 超时时间计算：基础 10 分钟 + 每 MB 5 秒，最大 30 分钟

**处理逻辑**：
1. 判断是否为可重试错误（网络错误、超时）
2. 如果可重试且未达到最大重试次数（3 次），自动重试：
   - 重新获取上传凭证（presigned URL 可能已过期）
   - 使用新的凭证重新上传
   - 指数退避延迟（最多 10 秒）
3. 如果不可重试或达到最大重试次数，抛出错误
4. 错误被 `uploadSingleFile` 的 catch 块捕获：
   - 尝试清理数据库记录（使用 `photoId`）
   - 如果清理失败，延迟 2 秒后调用 `check-pending` API

**代码位置**：
- 上传逻辑：`photo-uploader.tsx` 第 277-466 行
- 失败处理：`photo-uploader.tsx` 第 692-747 行

### 3. 重试失败

**触发时机**：重试上传时失败

**失败判断**：
- 重新获取凭证失败
- 重新上传失败（达到最大重试次数）

**处理逻辑**：
- 抛出错误，被 `uploadSingleFile` 的 catch 块捕获
- 注意：重试时会创建新的 `photoId`，但旧的 `photoId` 可能还在数据库中
- 需要确保清理旧的 `photoId`（如果存在）

**代码位置**：`photo-uploader.tsx` 第 403-442 行

### 4. 处理触发失败

**触发时机**：上传成功后，调用 `/api/admin/photos/process` 失败

**失败判断**：
- fetch 抛出异常（网络错误、超时等）
- HTTP 状态码不在 200-299 范围内

**处理逻辑**：
- 延迟 3 秒后调用 `check-pending` API
- 检查文件是否存在，如果存在则重新加入处理队列

**代码位置**：`photo-uploader.tsx` 第 451-465 行

## 失败场景总结

| 失败场景 | 失败判断 | 是否重试 | 清理逻辑 | check-pending 触发 |
|---------|---------|---------|---------|------------------|
| 获取凭证失败 | HTTP 非 2xx 或缺少 uploadUrl | ❌ | 如果 photoId 存在则清理 | 清理失败时触发 |
| HTTP 状态码错误 | status < 200 或 >= 300 | ❌ | 清理 photoId | 清理失败时触发 |
| 网络错误 | xhr.status === 0 | ✅ (最多 3 次) | 重试失败后清理 | 清理失败时触发 |
| 上传超时 | xhr.ontimeout | ✅ (最多 3 次) | 重试失败后清理 | 清理失败时触发 |
| 重试失败 | 达到最大重试次数 | ❌ | 清理 photoId | 清理失败时触发 |
| 处理触发失败 | fetch 异常或非 2xx | ❌ | N/A | 延迟 3 秒后触发 |

## 潜在问题

### 问题 1：重试时创建新 photoId

**场景**：上传失败后重试，会重新获取凭证，可能创建新的 `photoId`，但旧的 `photoId` 仍在数据库中。

**当前处理**：
- 重试时使用新的 `photoId`，旧的 `photoId` 不会被清理
- 如果重试最终失败，只会清理新的 `photoId`

**建议改进**：
- 重试时记录旧的 `photoId`，如果重试成功则清理旧的，如果重试失败则清理新的和旧的

### 问题 2：暂停状态的处理

**场景**：用户暂停上传，`xhr.onabort` 不会 reject promise，上传不会失败。

**当前处理**：
- 暂停时不会触发清理或 check-pending
- 如果用户取消暂停后继续上传，会继续使用原有的 `photoId`

**这是正确的行为**，不需要修改。

## 改进建议

### 1. 重试时清理旧 photoId

在重试逻辑中，如果创建了新的 `photoId`，应该清理旧的：

```typescript
// 重试时，如果创建了新 photoId，清理旧的
if (oldPhotoId && oldPhotoId !== photoId) {
  try {
    await fetch(`/api/admin/photos/${oldPhotoId}/cleanup`, {
      method: 'DELETE',
    })
  } catch {
    // 忽略清理错误
  }
}
```

### 2. 统一失败处理

所有失败场景都应该：
1. 尝试清理数据库记录
2. 如果清理失败，触发 `check-pending` API
3. 记录错误日志

## 相关文件

- `apps/web/src/components/admin/photo-uploader.tsx` - 前端上传组件
- `apps/web/src/app/api/admin/photos/[id]/cleanup/route.ts` - 清理 API
- `apps/web/src/app/api/admin/albums/[id]/check-pending/route.ts` - 检查 pending API
- `services/worker/src/index.ts` - Worker 检查逻辑
