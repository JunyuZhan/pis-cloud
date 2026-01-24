/**
 * PIS Worker - Image Processing Service
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// 从根目录加载 .env.local（monorepo 统一配置）
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../');
config({ path: resolve(rootDir, '.env.local') });
import http from 'http';
import { Worker, Job, Queue } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { connection, QUEUE_NAME, photoQueue } from './lib/redis.js';
import { 
  downloadFile, 
  uploadFile, 
  uploadBuffer,
  initMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedGetUrl,
  getPresignedPutUrl,
  listObjects,
  copyFile,
  deleteFile,
  bucketName
} from './lib/storage/index.js';
import { PhotoProcessor } from './processor.js';
import { PackageCreator } from './package-creator.js';

// 检查必要的环境变量 (支持两种变量名)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Please configure these values in the root .env.local file');
  process.exit(1);
}

// 初始化 Supabase 客户端 (Service Role 用于后端操作)
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PhotoJobData {
  photoId: string;
  albumId: string;
  originalKey: string;
}

interface PackageJobData {
  packageId: string;
  albumId: string;
  photoIds: string[];
  includeWatermarked: boolean;
  includeOriginal: boolean;
}

console.log('🚀 PIS Worker Starting...');

const worker = new Worker<PhotoJobData>(
  QUEUE_NAME,
  async (job: Job<PhotoJobData>) => {
    const { photoId, albumId, originalKey } = job.data;
    console.log(`[${job.id}] Processing photo ${photoId} for album ${albumId}`);

    try {
      // 1. 更新状态为 processing
      await supabase
        .from('photos')
        .update({ status: 'processing' })
        .eq('id', photoId);

      // 2. 从存储下载原图
      console.time(`[${job.id}] Download`);
      const originalBuffer = await downloadFile(originalKey);
      console.timeEnd(`[${job.id}] Download`);

      // 3. 获取照片的手动旋转角度
      const { data: photo } = await supabase
        .from('photos')
        .select('rotation')
        .eq('id', photoId)
        .single();

      // 4. 获取相册水印配置
      const { data: album } = await supabase
        .from('albums')
        .select('watermark_enabled, watermark_type, watermark_config')
        .eq('id', albumId)
        .single();

      // 构建水印配置（支持新旧格式）
      const watermarkConfigRaw = (album?.watermark_config as any) || {};
      const watermarkConfig = {
        enabled: album?.watermark_enabled ?? false,
        // 如果包含 watermarks 数组，使用新格式
        watermarks: watermarkConfigRaw.watermarks || undefined,
        // 兼容旧格式
        type: album?.watermark_type ?? watermarkConfigRaw.type ?? 'text',
        text: watermarkConfigRaw.text,
        logoUrl: watermarkConfigRaw.logoUrl,
        opacity: watermarkConfigRaw.opacity ?? 0.5,
        position: watermarkConfigRaw.position ?? 'center',
      };

      // 5. 处理图片 (Sharp)
      console.time(`[${job.id}] Process`);
      const processor = new PhotoProcessor(originalBuffer);
      const result = await processor.process(watermarkConfig, photo?.rotation ?? null);
      console.timeEnd(`[${job.id}] Process`);

      // 6. 上传处理后的图片到存储
      const thumbKey = `processed/thumbs/${albumId}/${photoId}.jpg`;
      const previewKey = `processed/previews/${albumId}/${photoId}.jpg`;

      console.time(`[${job.id}] Upload`);
      await Promise.all([
        uploadFile(thumbKey, result.thumbBuffer, { 'Content-Type': 'image/jpeg' }),
        uploadFile(previewKey, result.previewBuffer, { 'Content-Type': 'image/jpeg' }),
      ]);
      console.timeEnd(`[${job.id}] Upload`);

      // 7. 更新数据库
      const { error } = await supabase
        .from('photos')
        .update({
          status: 'completed',
          thumb_key: thumbKey,
          preview_key: previewKey,
          width: result.metadata.width,
          height: result.metadata.height,
          blur_data: result.blurHash,
          exif: result.exif,
          file_size: originalBuffer.length,
          mime_type: result.metadata.format,
          // 尝试从 EXIF 获取拍摄时间，否则用当前时间
          captured_at: result.exif?.exif?.DateTimeOriginal || new Date().toISOString(),
          // 更新时间戳（用于前端缓存破坏）
          updated_at: new Date().toISOString(),
        })
        .eq('id', photoId);

      if (error) throw error;

      // 8. 更新相册照片数量
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', albumId)
        .eq('status', 'completed');
      
      await supabase
        .from('albums')
        .update({ photo_count: count || 0 })
        .eq('id', albumId);

      console.log(`[${job.id}] Completed successfully`);
    } catch (err: any) {
      console.error(`[${job.id}] Failed:`, err);
      
      // 更新状态为 failed
      await supabase
        .from('photos')
        .update({ status: 'failed' })
        .eq('id', photoId);
      
      throw err; // 让 BullMQ 知道任务失败 (以便重试)
    }
  },
  {
    connection,
    concurrency: 5, // 适当增加并发
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log(`✅ Worker listening on queue: ${QUEUE_NAME}`);

// ============================================
// 打包下载 Worker
// ============================================
const packageQueue = new Queue('package-downloads', { connection });

const packageWorker = new Worker<PackageJobData>(
  'package-downloads',
  async (job: Job<PackageJobData>) => {
    const { packageId, albumId, photoIds, includeWatermarked, includeOriginal } = job.data;
    console.log(`[Package ${job.id}] Processing package ${packageId} for album ${albumId}`);

    try {
      // 1. 更新状态为 processing
      await supabase
        .from('package_downloads')
        .update({ status: 'processing' })
        .eq('id', packageId);

      // 2. 获取相册水印配置和标题
      const { data: album } = await supabase
        .from('albums')
        .select('title, watermark_enabled, watermark_type, watermark_config')
        .eq('id', albumId)
        .single();

      const watermarkConfig = album?.watermark_enabled
        ? {
            enabled: true,
            type: album.watermark_type || 'text',
            ...((album.watermark_config as any) || {}),
          }
        : undefined;

      // 3. 获取照片信息
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, original_key, preview_key')
        .in('id', photoIds)
        .eq('status', 'completed');

      if (!photos || photos.length === 0) {
        throw new Error('No photos found');
      }

      // 4. 创建 ZIP 包
      console.time(`[Package ${job.id}] Create ZIP`);
      const zipBuffer = await PackageCreator.createPackage({
        photos: photos.map(p => ({
          id: p.id,
          filename: p.filename,
          originalKey: p.original_key,
          previewKey: p.preview_key,
        })),
        albumId,
        watermarkConfig,
        includeWatermarked,
        includeOriginal,
      });
      console.timeEnd(`[Package ${job.id}] Create ZIP`);

      // 5. 上传 ZIP 到存储
      const zipKey = `packages/${albumId}/${packageId}.zip`;
      const albumTitle = (album as any)?.title || 'photos';
      console.time(`[Package ${job.id}] Upload ZIP`);
      await uploadFile(zipKey, zipBuffer, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${albumTitle}.zip"`,
      });
      console.timeEnd(`[Package ${job.id}] Upload ZIP`);

      // 6. 生成下载链接（15天有效期）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);
      const downloadUrl = await getPresignedGetUrl(zipKey, 15 * 24 * 60 * 60); // 15天

      // 7. 更新数据库
      await supabase
        .from('package_downloads')
        .update({
          status: 'completed',
          zip_key: zipKey,
          file_size: zipBuffer.length,
          download_url: downloadUrl,
          expires_at: expiresAt.toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', packageId);

      console.log(`[Package ${job.id}] Completed successfully`);
    } catch (err: any) {
      console.error(`[Package ${job.id}] Failed:`, err);

      // 更新状态为 failed
      await supabase
        .from('package_downloads')
        .update({ status: 'failed' })
        .eq('id', packageId);

      throw err;
    }
  },
  {
    connection,
    concurrency: 2, // 打包任务并发数较低，因为资源消耗大
  }
);

packageWorker.on('failed', (job, err) => {
  console.error(`❌ Package job ${job?.id} failed:`, err.message);
});

console.log(`✅ Package worker listening on queue: package-downloads`);

// ============================================
// HTTP API 服务器 (用于接收上传请求)
// ============================================

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001');

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${HTTP_PORT}`);

  // 健康检查
  if (url.pathname === '/health') {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // 检查 Redis 连接（通过队列测试）
    try {
      const testQueue = new Queue('health-check', { connection });
      await testQueue.getWaitingCount(); // 轻量级操作测试连接
      await testQueue.close();
      health.services.redis = { status: 'ok' };
    } catch (err: any) {
      health.services.redis = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // 检查 Supabase 连接
    try {
      const { error } = await supabase.from('albums').select('id').limit(1);
      if (error) throw error;
      health.services.supabase = { status: 'ok' };
    } catch (err: any) {
      health.services.supabase = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // 检查存储连接
    try {
      const storageModule = await import('./lib/storage/index.js');
      const testKey = `health-check-${Date.now()}.txt`;
      // 尝试列出 bucket（轻量级操作）
      health.services.storage = { 
        status: 'ok', 
        bucket: storageModule.bucketName,
        type: process.env.STORAGE_TYPE || 'minio'
      };
    } catch (err: any) {
      health.services.storage = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // 获取预签名上传 URL (保留兼容)
  if (url.pathname === '/api/presign' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { key } = JSON.parse(body);
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key' }));
          return;
        }

        const presignedUrl = await getPresignedPutUrl(key);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: presignedUrl }));
      } catch (err: any) {
        console.error('Presign error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 直接上传文件到 MinIO (代理模式)
  if (url.pathname === '/api/upload' && req.method === 'PUT') {
    const key = url.searchParams.get('key');
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    
    console.log(`[Upload] Received upload request for key: ${key}`);
    
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing key parameter' }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        console.log(`[Upload] Uploading ${buffer.length} bytes to storage: ${key}`);
        await uploadFile(key, buffer, { 'Content-Type': contentType });
        console.log(`[Upload] Successfully uploaded: ${key}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, key }));
      } catch (err: any) {
        console.error('Upload error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 触发照片处理
  if (url.pathname === '/api/process' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { photoId, albumId, originalKey } = JSON.parse(body);
        if (!photoId || !albumId || !originalKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        // 添加到处理队列
        await photoQueue.add('process-photo', { photoId, albumId, originalKey });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Job queued' }));
      } catch (err: any) {
        console.error('Process queue error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ============================================
  // 分片上传 API
  // ============================================

  // 初始化分片上传
  if (url.pathname === '/api/multipart/init' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { key } = JSON.parse(body);
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key' }));
          return;
        }

        console.log(`[Multipart] Initializing upload for key: ${key}`);
        const uploadId = await initMultipartUpload(key);
        console.log(`[Multipart] Initialized upload for ${key}, uploadId: ${uploadId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ uploadId, key }));
      } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error';
        const errorStack = err?.stack || '';
        console.error('[Multipart] Init error:', errorMessage);
        console.error('[Multipart] Error stack:', errorStack);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorStack : undefined
        }));
      }
    });
    return;
  }

  // 上传单个分片
  if (url.pathname === '/api/multipart/upload' && req.method === 'PUT') {
    const key = url.searchParams.get('key');
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = parseInt(url.searchParams.get('partNumber') || '0');

    if (!key || !uploadId || !partNumber) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing key, uploadId, or partNumber' }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        console.log(`[Multipart] Uploading part ${partNumber} for ${key}, size: ${buffer.length}`);
        
        const { etag } = await uploadPart(key, uploadId, partNumber, buffer);
        console.log(`[Multipart] Part ${partNumber} uploaded, etag: ${etag}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ etag, partNumber }));
      } catch (err: any) {
        console.error('Multipart upload error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 完成分片上传
  if (url.pathname === '/api/multipart/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { key, uploadId, parts } = JSON.parse(body);
        if (!key || !uploadId || !parts || !Array.isArray(parts)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key, uploadId, or parts' }));
          return;
        }

        await completeMultipartUpload(key, uploadId, parts);
        console.log(`[Multipart] Completed upload for ${key}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, key }));
      } catch (err: any) {
        console.error('Multipart complete error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 取消分片上传
  if (url.pathname === '/api/multipart/abort' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { key, uploadId } = JSON.parse(body);
        if (!key || !uploadId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key or uploadId' }));
          return;
        }

        await abortMultipartUpload(key, uploadId);
        console.log(`[Multipart] Aborted upload for ${key}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        console.error('Multipart abort error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ============================================
  // 扫描同步 API
  // ============================================

  // 扫描同步
  if (url.pathname === '/api/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { albumId } = JSON.parse(body);
        if (!albumId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing albumId' }));
          return;
        }

        console.log(`[Scan] Starting scan for album: ${albumId}`);
        
        // 1. 列出 sync/{albumId}/ 下的所有文件
        const prefix = `sync/${albumId}/`;
        const objects = await listObjects(prefix);
        
        // 2. 过滤出图片文件
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp'];
        const imageObjects = objects.filter(obj => {
          const ext = obj.key.toLowerCase().slice(obj.key.lastIndexOf('.'));
          return imageExtensions.includes(ext);
        });

        console.log(`[Scan] Found ${imageObjects.length} images in ${prefix}`);

        if (imageObjects.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            found: 0, 
            added: 0,
            skipped: 0,
            message: '未找到新图片' 
          }));
          return;
        }

        // 3. 查询数据库已有的文件（通过 filename 比对）
        const { data: existingPhotos } = await supabase
          .from('photos')
          .select('filename')
          .eq('album_id', albumId);
        
        const existingFilenames = new Set(
          (existingPhotos || []).map(p => p.filename)
        );

        // 4. 处理新图片
        let addedCount = 0;
        let skippedCount = 0;
        for (const obj of imageObjects) {
          const filename = obj.key.split('/').pop() || '';
          
          // 跳过已存在的文件
          if (existingFilenames.has(filename)) {
            console.log(`[Scan] Skipping existing: ${filename}`);
            skippedCount++;
            continue;
          }

          // 生成新的 photo_id
          const photoId = crypto.randomUUID();
          const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
          const newKey = `raw/${albumId}/${photoId}.${ext}`;

          try {
            // 复制文件到标准路径
            await copyFile(obj.key, newKey);
            console.log(`[Scan] Copied ${obj.key} -> ${newKey}`);

            // 创建数据库记录
            const { error: insertError } = await supabase
              .from('photos')
              .insert({
                id: photoId,
                album_id: albumId,
                original_key: newKey,
                filename: filename,
                file_size: obj.size,
                status: 'pending',
              });

            if (insertError) {
              console.error(`[Scan] Failed to insert photo: ${insertError.message}`);
              // 如果数据库插入失败，删除已复制的文件
              try {
                await deleteFile(newKey);
              } catch (deleteErr) {
                console.error(`[Scan] Failed to cleanup copied file: ${deleteErr}`);
              }
              continue;
            }

            // 添加到处理队列
            await photoQueue.add('process-photo', { 
              photoId, 
              albumId, 
              originalKey: newKey 
            });

            // 删除原始文件（可选，或保留备份）
            try {
              await deleteFile(obj.key);
            } catch (deleteErr) {
              console.warn(`[Scan] Failed to delete source file ${obj.key}: ${deleteErr}`);
              // 不阻止流程继续
            }
            
            addedCount++;
          } catch (err: any) {
            console.error(`[Scan] Error processing ${filename}:`, err.message);
            // 继续处理下一个文件
          }
        }

        console.log(`[Scan] Added ${addedCount} new photos, skipped ${skippedCount}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          found: imageObjects.length,
          skipped: skippedCount,
          added: addedCount,
          message: addedCount > 0 
            ? `成功导入 ${addedCount} 张新图片${skippedCount > 0 ? `，跳过 ${skippedCount} 张已存在图片` : ''}`
            : `未找到新图片${skippedCount > 0 ? `，跳过 ${skippedCount} 张已存在图片` : ''}`
        }));
      } catch (err: any) {
        console.error('[Scan] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP API listening on port ${HTTP_PORT}`);
});

// 优雅退出
process.on('SIGTERM', async () => {
  server.close();
  await worker.close();
});
