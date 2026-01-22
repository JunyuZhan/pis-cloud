import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT_HOST || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'password123',
});

export const bucketName = process.env.MINIO_BUCKET || 'pis-photos';

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

export default minioClient;
