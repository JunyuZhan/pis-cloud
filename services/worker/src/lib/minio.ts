import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT_HOST || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'password123',
});

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

// 公网 MinIO URL (用于生成可从外部访问的 Presigned URL)
const publicMinioUrl = process.env.MINIO_PUBLIC_URL || '';

// 替换内网地址为公网地址
function toPublicUrl(url: string): string {
  if (!publicMinioUrl) return url;
  
  // 替换 http://law-firm-minio:9000 或 http://localhost:9000 为公网地址
  const internalHost = `${process.env.MINIO_ENDPOINT_HOST || 'localhost'}:${process.env.MINIO_ENDPOINT_PORT || '9000'}`;
  return url.replace(`http://${internalHost}`, publicMinioUrl);
}

// 生成预签名上传 URL
export async function getPresignedPutUrl(key: string, expirySeconds = 3600): Promise<string> {
  const url = await minioClient.presignedPutObject(bucketName, key, expirySeconds);
  return toPublicUrl(url);
}

// 生成预签名下载 URL
export async function getPresignedGetUrl(key: string, expirySeconds = 3600): Promise<string> {
  const url = await minioClient.presignedGetObject(bucketName, key, expirySeconds);
  return toPublicUrl(url);
}

export default minioClient;
