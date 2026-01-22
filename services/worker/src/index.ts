import 'dotenv/config';
import http from 'http';
import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { connection, QUEUE_NAME, photoQueue } from './lib/redis.js';
import { 
  downloadFile, 
  uploadFile, 
  getMinioClient, 
  uploadBuffer,
  initMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload
} from './lib/minio.js';
import { PhotoProcessor } from './processor.js';

// 检查必要的环境变量
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Please create services/worker/.env file with these values');
  process.exit(1);
}

// 初始化 Supabase 客户端 (Service Role 用于后端操作)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

interface PhotoJobData {
  photoId: string;
  albumId: string;
  originalKey: string;
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

      // 2. 从 MinIO 下载原图
      console.time(`[${job.id}] Download`);
      const originalBuffer = await downloadFile(originalKey);
      console.timeEnd(`[${job.id}] Download`);

      // 3. 获取相册水印配置
      const { data: album } = await supabase
        .from('albums')
        .select('watermark_enabled, watermark_type, watermark_config')
        .eq('id', albumId)
        .single();

      const watermarkConfig = {
        enabled: album?.watermark_enabled ?? false,
        type: album?.watermark_type ?? 'text',
        ...((album?.watermark_config as any) || {}),
      };

      // 4. 处理图片 (Sharp)
      console.time(`[${job.id}] Process`);
      const processor = new PhotoProcessor(originalBuffer);
      const result = await processor.process(watermarkConfig);
      console.timeEnd(`[${job.id}] Process`);

      // 5. 上传处理后的图片到 MinIO
      const thumbKey = `processed/thumbs/${albumId}/${photoId}.jpg`;
      const previewKey = `processed/previews/${albumId}/${photoId}.jpg`;

      console.time(`[${job.id}] Upload`);
      await Promise.all([
        uploadFile(thumbKey, result.thumbBuffer, { 'Content-Type': 'image/jpeg' }),
        uploadFile(previewKey, result.previewBuffer, { 'Content-Type': 'image/jpeg' }),
      ]);
      console.timeEnd(`[${job.id}] Upload`);

      // 5. 更新数据库
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
        })
        .eq('id', photoId);

      if (error) throw error;

      // 6. 更新相册照片数量
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
// HTTP API 服务器 (用于接收上传请求)
// ============================================
import { getPresignedPutUrl, bucketName } from './lib/minio.js';

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
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
        console.log(`[Upload] Uploading ${buffer.length} bytes to MinIO: ${key}`);
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

        const uploadId = await initMultipartUpload(key);
        console.log(`[Multipart] Initialized upload for ${key}, uploadId: ${uploadId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ uploadId, key }));
      } catch (err: any) {
        console.error('Multipart init error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
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
