import * as Minio from 'minio';

// 内网 MinIO 客户端（用于实际上传/下载操作）
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT_HOST || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'password123',
});

// 公网 MinIO 客户端（用于生成 presigned URL，签名需要匹配公网地址）
function createPublicMinioClient(): Minio.Client | null {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return null;
  
  try {
    const url = new URL(publicUrl);
    return new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
      useSSL: url.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'password123',
    });
  } catch (e) {
    console.warn('Failed to create public MinIO client:', e);
    return null;
  }
}

const publicMinioClient = createPublicMinioClient();

export const bucketName = process.env.MINIO_BUCKET || 'pis-photos';

export function getMinioClient(): Minio.Client {
  return minioClient;
}

export async function downloadFile(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(bucketName, key);
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  metaData: Record<string, string> = {}
): Promise<{ etag: string; versionId: string | null }> {
  return minioClient.putObject(bucketName, key, buffer, buffer.length, metaData);
}

// Alias for uploadFile
export const uploadBuffer = uploadFile;

// 生成预签名上传 URL（使用公网客户端，确保签名匹配）
export async function getPresignedPutUrl(key: string, expirySeconds = 3600): Promise<string> {
  // 优先使用公网客户端（签名会基于公网地址生成）
  const client = publicMinioClient || minioClient;
  return client.presignedPutObject(bucketName, key, expirySeconds);
}

// 生成预签名下载 URL
export async function getPresignedGetUrl(key: string, expirySeconds = 3600): Promise<string> {
  const client = publicMinioClient || minioClient;
  return client.presignedGetObject(bucketName, key, expirySeconds);
}

// ============ 分片上传 API ============

// 初始化分片上传
export async function initMultipartUpload(key: string): Promise<string> {
  // MinIO SDK 不直接暴露 initiateMultipartUpload，使用底层 API
  const client = minioClient as any;
  return new Promise((resolve, reject) => {
    client.initiateNewMultipartUpload(bucketName, key, {}, (err: Error, uploadId: string) => {
      if (err) reject(err);
      else resolve(uploadId);
    });
  });
}

// 上传单个分片
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer
): Promise<{ etag: string }> {
  const client = minioClient as any;
  return new Promise((resolve, reject) => {
    client.uploadPart(
      { bucketName, objectName: key, uploadId, partNumber, headers: {} },
      buffer,
      (err: Error, etag: string) => {
        if (err) reject(err);
        else resolve({ etag });
      }
    );
  });
}

// 完成分片上传
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> {
  const client = minioClient as any;
  return new Promise((resolve, reject) => {
    client.completeMultipartUpload(bucketName, key, uploadId, parts, (err: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 取消分片上传
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const client = minioClient as any;
  return new Promise((resolve, reject) => {
    client.abortMultipartUpload(bucketName, key, uploadId, (err: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default minioClient;
