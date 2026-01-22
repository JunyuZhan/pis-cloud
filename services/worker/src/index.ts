import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { connection, QUEUE_NAME } from './lib/redis.js';
import { downloadFile, uploadFile } from './lib/minio.js';
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

// 优雅退出
process.on('SIGTERM', async () => {
  await worker.close();
});
