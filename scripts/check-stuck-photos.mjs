#!/usr/bin/env node
/**
 * 检查卡住的照片处理任务
 * 查询数据库中processing状态的照片，并检查Redis队列状态
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

async function checkStuckPhotos() {
  console.log('🔍 检查卡住的照片处理任务...\n');

  try {
    // 1. 查询所有processing状态的照片
    console.log('📋 查询数据库中状态为 processing 的照片...');
    const { data: processingPhotos, error: processingError } = await supabase
      .from('photos')
      .select('id, album_id, filename, original_key, thumb_key, preview_key, status, created_at, updated_at')
      .eq('status', 'processing')
      .order('updated_at', { ascending: true });

    if (processingError) {
      console.error('❌ 查询processing照片失败:', processingError);
      return;
    }

    console.log(`   找到 ${processingPhotos?.length || 0} 张processing状态的照片\n`);

    // 2. 查询pending状态的照片
    console.log('📋 查询数据库中状态为 pending 的照片...');
    const { data: pendingPhotos, error: pendingError } = await supabase
      .from('photos')
      .select('id, album_id, filename, original_key, status, created_at, updated_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (pendingError) {
      console.error('❌ 查询pending照片失败:', pendingError);
      return;
    }

    console.log(`   找到 ${pendingPhotos?.length || 0} 张pending状态的照片\n`);

    // 3. 检查Redis队列状态
    console.log('📋 检查Redis队列状态...');
    const waitingJobs = await photoQueue.getWaiting();
    const activeJobs = await photoQueue.getActive();
    const failedJobs = await photoQueue.getFailed();
    const completedJobs = await photoQueue.getCompleted();

    console.log(`   等待中: ${waitingJobs.length}`);
    console.log(`   处理中: ${activeJobs.length}`);
    console.log(`   失败: ${failedJobs.length}`);
    console.log(`   已完成: ${completedJobs.length}\n`);

    const waitingPhotoIds = new Set(
      [...waitingJobs, ...activeJobs].map(job => job.data.photoId)
    );

    // 4. 分析processing状态的照片
    if (processingPhotos && processingPhotos.length > 0) {
      console.log('📊 Processing状态照片分析:');
      console.log('─'.repeat(80));
      
      let inQueueCount = 0;
      let completedButNotUpdated = 0;
      let stuckCount = 0;

      for (const photo of processingPhotos) {
        const inQueue = waitingPhotoIds.has(photo.id);
        const hasThumbAndPreview = photo.thumb_key && photo.preview_key;
        
        if (inQueue) {
          inQueueCount++;
          console.log(`✅ ${photo.id.substring(0, 8)}... - ${photo.filename}`);
          console.log(`   状态: 在队列中处理`);
        } else if (hasThumbAndPreview) {
          completedButNotUpdated++;
          console.log(`⚠️  ${photo.id.substring(0, 8)}... - ${photo.filename}`);
          console.log(`   状态: 已处理完成但状态未更新`);
          console.log(`   更新时间: ${photo.updated_at}`);
        } else {
          stuckCount++;
          console.log(`❌ ${photo.id.substring(0, 8)}... - ${photo.filename}`);
          console.log(`   状态: 卡住（不在队列中且未完成）`);
          console.log(`   更新时间: ${photo.updated_at}`);
          console.log(`   original_key: ${photo.original_key}`);
        }
        console.log('');
      }

      console.log('─'.repeat(80));
      console.log(`总结:`);
      console.log(`  - 在队列中: ${inQueueCount}`);
      console.log(`  - 已完成但状态未更新: ${completedButNotUpdated}`);
      console.log(`  - 卡住: ${stuckCount}\n`);
    }

    // 5. 分析pending状态的照片
    if (pendingPhotos && pendingPhotos.length > 0) {
      console.log('📊 Pending状态照片分析:');
      console.log('─'.repeat(80));
      
      let inQueueCount = 0;
      let notInQueueCount = 0;

      for (const photo of pendingPhotos.slice(0, 20)) { // 只显示前20个
        const inQueue = waitingPhotoIds.has(photo.id);
        
        if (inQueue) {
          inQueueCount++;
        } else {
          notInQueueCount++;
          console.log(`⚠️  ${photo.id.substring(0, 8)}... - ${photo.filename}`);
          console.log(`   状态: pending但不在队列中`);
          console.log(`   创建时间: ${photo.created_at}`);
          console.log(`   original_key: ${photo.original_key}`);
          console.log('');
        }
      }

      if (pendingPhotos.length > 20) {
        console.log(`   ... 还有 ${pendingPhotos.length - 20} 张pending照片未显示\n`);
      }

      console.log('─'.repeat(80));
      console.log(`总结:`);
      console.log(`  - 在队列中: ${inQueueCount}`);
      console.log(`  - 不在队列中: ${notInQueueCount}\n`);
    }

    // 6. 显示队列中的任务详情
    if (activeJobs.length > 0) {
      console.log('📊 当前正在处理的任务:');
      console.log('─'.repeat(80));
      for (const job of activeJobs) {
        console.log(`Job ${job.id}:`);
        console.log(`  Photo ID: ${job.data.photoId}`);
        console.log(`  Album ID: ${job.data.albumId}`);
        console.log(`  Original Key: ${job.data.originalKey}`);
        console.log(`  开始时间: ${new Date(job.processedOn || 0).toISOString()}`);
        console.log('');
      }
    }

    if (waitingJobs.length > 0) {
      console.log('📊 等待处理的任务:');
      console.log('─'.repeat(80));
      for (const job of waitingJobs.slice(0, 10)) { // 只显示前10个
        console.log(`Job ${job.id}:`);
        console.log(`  Photo ID: ${job.data.photoId}`);
        console.log(`  Album ID: ${job.data.albumId}`);
        console.log(`  创建时间: ${new Date(job.timestamp).toISOString()}`);
        console.log('');
      }
      if (waitingJobs.length > 10) {
        console.log(`  ... 还有 ${waitingJobs.length - 10} 个任务在等待\n`);
      }
    }

    await photoQueue.close();
  } catch (err) {
    console.error('❌ 检查失败:', err);
    await photoQueue.close();
    process.exit(1);
  }
}

checkStuckPhotos();
