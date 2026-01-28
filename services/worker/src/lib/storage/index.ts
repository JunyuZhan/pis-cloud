/**
 * 存储抽象层工厂
 * 根据配置自动选择存储适配器
 */
import type { StorageAdapter, StorageConfig } from './types.js';
import { MinIOAdapter } from './minio-adapter.js';
import { OSSAdapter } from './oss-adapter.js';
import { COSAdapter } from './cos-adapter.js';

let storageAdapter: StorageAdapter | null = null;

/**
 * 从环境变量创建存储配置
 */
function getStorageConfigFromEnv(): StorageConfig {
  const type = (process.env.STORAGE_TYPE || 'minio') as StorageConfig['type'];
  
  return {
    type,
    endpoint: process.env.STORAGE_ENDPOINT || process.env.MINIO_ENDPOINT_HOST,
    port: process.env.STORAGE_PORT 
      ? parseInt(process.env.STORAGE_PORT) 
      : process.env.MINIO_ENDPOINT_PORT 
        ? parseInt(process.env.MINIO_ENDPOINT_PORT) 
        : undefined,
    useSSL: process.env.STORAGE_USE_SSL === 'true' || process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.STORAGE_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.STORAGE_SECRET_KEY || process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.STORAGE_BUCKET || process.env.MINIO_BUCKET || 'pis-photos',
    region: process.env.STORAGE_REGION,
    customConfig: {
      publicUrl: process.env.STORAGE_PUBLIC_URL || process.env.MINIO_PUBLIC_URL,
    },
  };
}

/**
 * 创建存储适配器
 */
export function createStorageAdapter(config?: StorageConfig): StorageAdapter {
  const finalConfig = config || getStorageConfigFromEnv();

  switch (finalConfig.type) {
    case 'minio':
      return new MinIOAdapter(finalConfig);
    case 'oss':
      return new OSSAdapter(finalConfig);
    case 'cos':
      return new COSAdapter(finalConfig);
    case 's3':
      // AWS S3 也使用 MinIO SDK（S3 兼容）
      return new MinIOAdapter({
        ...finalConfig,
        endpoint: finalConfig.endpoint || `s3.${finalConfig.region || 'us-east-1'}.amazonaws.com`,
      });
    default:
      throw new Error(`Unsupported storage type: ${finalConfig.type}`);
  }
}

/**
 * 获取单例存储适配器
 */
export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    storageAdapter = createStorageAdapter();
  }
  return storageAdapter;
}

/**
 * 导出类型和适配器类（供高级用法）
 */
export * from './types.js';
export { MinIOAdapter } from './minio-adapter.js';
export { OSSAdapter } from './oss-adapter.js';
export { COSAdapter } from './cos-adapter.js';

// 兼容旧 API
export const bucketName = process.env.STORAGE_BUCKET || process.env.MINIO_BUCKET || 'pis-photos';

export async function downloadFile(key: string): Promise<Buffer> {
  return getStorageAdapter().download(key);
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  metaData: Record<string, string> = {}
) {
  return getStorageAdapter().upload(key, buffer, metaData);
}

export const uploadBuffer = uploadFile;

export async function getPresignedPutUrl(key: string, expirySeconds = 3600): Promise<string> {
  return getStorageAdapter().getPresignedPutUrl(key, expirySeconds);
}

export async function getPresignedGetUrl(key: string, expirySeconds = 3600): Promise<string> {
  return getStorageAdapter().getPresignedGetUrl(key, expirySeconds);
}

export async function initMultipartUpload(key: string): Promise<string> {
  return getStorageAdapter().initMultipartUpload(key);
}

export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer
): Promise<{ etag: string }> {
  return getStorageAdapter().uploadPart(key, uploadId, partNumber, buffer);
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expirySeconds = 3600
): Promise<string> {
  return getStorageAdapter().getPresignedPartUrl(key, uploadId, partNumber, expirySeconds);
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> {
  return getStorageAdapter().completeMultipartUpload(key, uploadId, parts);
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  return getStorageAdapter().abortMultipartUpload(key, uploadId);
}

export async function listObjects(prefix: string) {
  return getStorageAdapter().listObjects(prefix);
}

export async function copyFile(srcKey: string, destKey: string): Promise<void> {
  return getStorageAdapter().copy(srcKey, destKey);
}

export async function deleteFile(key: string): Promise<void> {
  return getStorageAdapter().delete(key);
}

export function getMinioClient() {
  // 为了向后兼容，返回存储适配器
  // 注意：新代码应该使用 getStorageAdapter()
  return getStorageAdapter();
}
