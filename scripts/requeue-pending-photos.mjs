#!/usr/bin/env node
/**
 * 将pending状态的照片重新加入处理队列
 * 用于修复上传失败但数据库记录已创建的情况
 */

import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../');
config({ path: resolve(rootDir, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const photoQueue = new Queue('photo-processing', { connection: redisConnection });

async function requeuePendingPhotos() {
  console.log('🔄 开始将pending状态的照片重新加入队列...\n');

  try {
    // 1. 查询所有pending状态的照片
    console.log('📋 查询pending状态的照片...');
    const { data: pendingPhotos, error } = await supabase
      .from('photos')
      .select('id, album_id, original_key, filename')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }

    if (!pendingPhotos || pendingPhotos.length === 0) {
      console.log('✅ 没有pending状态的照片');
      await photoQueue.close();
      return;
    }

    console.log(`   找到 ${pendingPhotos.length} 张pending状态的照片\n`);

    // 2. 检查队列中已有的任务
    const waitingJobs = await photoQueue.getWaiting();
    const activeJobs = await photoQueue.getActive();
    const waitingPhotoIds = new Set(
      [...waitingJobs, ...activeJobs].map(job => job.data.photoId)
    );

    console.log(`   当前队列状态:`);
    console.log(`   - 等待中: ${waitingJobs.length}`);
    console.log(`   - 处理中: ${activeJobs.length}\n`);

    // 3. 过滤出不在队列中的照片
    const photosToQueue = pendingPhotos.filter(photo => !waitingPhotoIds.has(photo.id));
    
    console.log(`   需要加入队列的照片: ${photosToQueue.length} 张\n`);

    if (photosToQueue.length === 0) {
      console.log('✅ 所有pending照片都已队列中');
      await photoQueue.close();
      return;
    }

    // 4. 批量加入队列
    console.log('📤 开始加入队列...');
    let successCount = 0;
    let errorCount = 0;

    for (const photo of photosToQueue) {
      try {
        await photoQueue.add('process-photo', {
          photoId: photo.id,
          albumId: photo.album_id,
          originalKey: photo.original_key,
        });
        successCount++;
        if (successCount % 10 === 0) {
          process.stdout.write(`   已加入 ${successCount}/${photosToQueue.length}...\r`);
        }
      } catch (err) {
        console.error(`\n❌ 加入队列失败 ${photo.id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n✅ 完成:`);
    console.log(`   - 成功: ${successCount}`);
    console.log(`   - 失败: ${errorCount}`);

    await photoQueue.close();
  } catch (err) {
    console.error('❌ 处理失败:', err);
    await photoQueue.close();
    process.exit(1);
  }
}

requeuePendingPhotos();
