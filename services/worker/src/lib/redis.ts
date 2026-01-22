import { Queue, Worker, QueueEvents, type ConnectionOptions } from 'bullmq';

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const QUEUE_NAME = 'photo-processing';

// 生产者队列 (用于在 API 端添加任务，Worker 端通常不需要这个，除非它是链式任务)
export const photoQueue = new Queue(QUEUE_NAME, { connection });

// 队列事件监听
export const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

export { connection };
