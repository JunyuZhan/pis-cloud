import { Queue, Worker, QueueEvents, type ConnectionOptions } from 'bullmq';

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  // BullMQ 要求 maxRetriesPerRequest 必须是 null
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    // 指数退避，最多等待 30 秒
    const delay = Math.min(times * 50, 30000);
    return delay;
  },
  // 连接超时
  connectTimeout: 10000,
  // 启用离线队列（连接断开时缓存命令）
  enableOfflineQueue: false,
};

export const QUEUE_NAME = 'photo-processing';

// 生产者队列 (用于在 API 端添加任务，Worker 端通常不需要这个，除非它是链式任务)
export const photoQueue = new Queue(QUEUE_NAME, { 
  connection,
  // 添加默认作业选项，避免连接错误时崩溃
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // 保留 24 小时
      count: 1000, // 最多保留 1000 个
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 失败任务保留 7 天
    },
  },
});

// 队列事件监听
export const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

// 添加连接错误处理（抑制重复错误日志）
let lastErrorTime = 0;
const ERROR_LOG_INTERVAL = 30000; // 30 秒内只记录一次错误

photoQueue.on('error', (error) => {
  const now = Date.now();
  if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
    console.error('⚠️ Redis connection error:', error.message);
    console.error('   This error will be suppressed for 30 seconds to reduce log spam');
    console.error('   Please check Redis connection:', {
      host: connection.host,
      port: connection.port,
      hasPassword: !!connection.password,
    });
    lastErrorTime = now;
  }
});

queueEvents.on('error', (error) => {
  const now = Date.now();
  if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
    console.error('⚠️ Redis QueueEvents error:', error.message);
    lastErrorTime = now;
  }
});

export { connection };
