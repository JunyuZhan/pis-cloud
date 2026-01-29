/**
 * MinIO 存储适配器
 * 
 * 使用 MinIO SDK 进行常规操作，使用 AWS SDK 进行分片上传（S3 兼容）
 */
import * as Minio from 'minio';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter, StorageConfig, UploadResult, StorageObject } from './types.js';

export class MinIOAdapter implements StorageAdapter {
  private client: Minio.Client;
  private presignClient: Minio.Client; // 专门用于生成 presigned URL 的客户端
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl?: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  private accessKey: string;
  private secretKey: string;
  private region?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.customConfig?.publicUrl;
    this.endpoint = config.endpoint || 'localhost';
    this.port = config.port || 9000;
    this.useSSL = config.useSSL ?? false;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.region = config.region;

    // MinIO 客户端用于常规操作（使用内网地址以提高性能）
    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      region: this.region,
    });

    // 用于生成 presigned URL 的客户端
    // 如果配置了 publicUrl，使用公网地址生成签名，避免签名不匹配问题
    // 注意：presignClient 需要使用与 publicUrl 相同的协议和端口来生成签名
    if (this.publicUrl) {
      try {
        const publicUrlObj = new URL(this.publicUrl);
        // 使用公网 URL 的协议和端口生成签名，确保签名匹配
        const publicPort = publicUrlObj.port ? parseInt(publicUrlObj.port) : (publicUrlObj.protocol === 'https:' ? 443 : 80);
        const publicUseSSL = publicUrlObj.protocol === 'https:';
        
        this.presignClient = new Minio.Client({
          endPoint: publicUrlObj.hostname,
          port: publicPort,
          useSSL: publicUseSSL, // 使用与 publicUrl 相同的协议
          accessKey: this.accessKey,
          secretKey: this.secretKey,
          region: this.region,
        });
        console.log(`[MinIO] Created presign client with public URL: ${publicUrlObj.protocol}//${publicUrlObj.hostname}:${publicPort} (SSL: ${publicUseSSL})`);
      } catch (e) {
        console.warn('[MinIO] Failed to create presign client with public URL, falling back to internal client:', e);
        this.presignClient = this.client;
      }
    } else {
      // 如果没有配置 publicUrl，使用内网客户端
      this.presignClient = this.client;
    }

    // AWS S3 客户端用于分片上传（MinIO 兼容 S3）
    const s3Endpoint = this.useSSL 
      ? `https://${this.endpoint}:${this.port}`
      : `http://${this.endpoint}:${this.port}`;
    
    this.s3Client = new S3Client({
      endpoint: s3Endpoint,
      region: this.region || 'us-east-1',
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
      forcePathStyle: true, // MinIO 需要路径样式
    });
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    metadata: Record<string, string> = {}
  ): Promise<UploadResult> {
    const result = await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      metadata
    );
    return {
      etag: result.etag,
      versionId: result.versionId,
    };
  }

  async getPresignedPutUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    // 使用 presignClient 生成 URL（如果配置了 publicUrl，签名会基于公网地址）
    const url = await this.presignClient.presignedPutObject(
      this.bucket,
      key,
      expirySeconds
    );
    // 如果 presignClient 已经使用公网地址，就不需要再替换了
    // 但为了兼容性，仍然检查是否需要替换
    return this.toPublicUrl(url);
  }

  async getPresignedGetUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    // 使用 presignClient 生成 URL（如果配置了 publicUrl，签名会基于公网地址）
    const url = await this.presignClient.presignedGetObject(
      this.bucket,
      key,
      expirySeconds
    );
    // 如果 presignClient 已经使用公网地址，就不需要再替换了
    // 但为了兼容性，仍然检查是否需要替换
    return this.toPublicUrl(url);
  }

  async initMultipartUpload(key: string): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.UploadId) {
        throw new Error('Failed to get upload ID from MinIO');
      }
      
      console.log(`[MinIO] Initiated multipart upload for ${key}, uploadId: ${response.UploadId}`);
      return response.UploadId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error initiating multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to initiate multipart upload: ${errorMessage}`);
    }
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.ETag) {
        throw new Error('Failed to get ETag from MinIO');
      }
      
      // AWS SDK 返回的 ETag 包含引号（如 "abc123"），保留原样用于 completeMultipartUpload
      // 但在返回时移除引号以保持接口一致性
      const etag = response.ETag.replace(/"/g, '');
      
      return { etag };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error uploading part ${partNumber} for ${key}:`, errorMessage);
      throw new Error(`Failed to upload part: ${errorMessage}`);
    }
  }

  async getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds = 3600
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      
      const url = await getSignedUrl(this.s3Client as any, command, { expiresIn: expirySeconds });
      
      // 如果配置了 publicUrl，替换为公网地址
      return this.toPublicUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error generating presigned URL for part ${partNumber} of ${key}:`, errorMessage);
      throw new Error(`Failed to generate presigned URL for part: ${errorMessage}`);
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    try {
      // AWS SDK 需要 Parts 数组格式，ETag 需要包含引号
      const partsArray = parts.map(part => ({
        PartNumber: part.partNumber,
        // 确保 ETag 包含引号（如果还没有的话）
        ETag: part.etag.startsWith('"') ? part.etag : `"${part.etag}"`,
      }));
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: partsArray,
        },
      });
      
      await this.s3Client.send(command);
      console.log(`[MinIO] Completed multipart upload for ${key}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error completing multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to complete multipart upload: ${errorMessage}`);
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });
      
      await this.s3Client.send(command);
      console.log(`[MinIO] Aborted multipart upload for ${key}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error aborting multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to abort multipart upload: ${errorMessage}`);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix: string): Promise<StorageObject[]> {
    const objects: StorageObject[] = [];
    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push({
            key: obj.name,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date(),
            etag: obj.etag || '',
          });
        }
      });
      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }

  async copy(srcKey: string, destKey: string): Promise<void> {
    try {
      // MinIO 的 copyObject 需要源对象路径格式为 /bucket/key
      const source = `/${this.bucket}/${srcKey}`;
      await this.client.copyObject(
        this.bucket,
        destKey,
        source
      );
      console.log(`[MinIO] Copied ${srcKey} -> ${destKey}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error copying ${srcKey} to ${destKey}:`, errorMessage);
      throw new Error(`Failed to copy object: ${errorMessage}`);
    }
  }

  private toPublicUrl(url: string): string {
    if (!this.publicUrl) return url;
    
    const publicUrlObj = new URL(this.publicUrl);
    const publicProtocol = publicUrlObj.protocol; // http: 或 https:
    const publicHost = publicUrlObj.port ? `${publicUrlObj.protocol}//${publicUrlObj.hostname}:${publicUrlObj.port}` : `${publicUrlObj.protocol}//${publicUrlObj.hostname}`;
    
    // 匹配 URL 中的协议和主机部分
    const match = url.match(/https?:\/\/([^\/]+)/);
    if (match) {
      const currentHost = match[0];
      // 如果当前 URL 已经是公网地址，只需要确保协议匹配（HTTP -> HTTPS）
      if (currentHost.includes(publicUrlObj.hostname)) {
        // 如果 publicUrl 是 HTTPS，但生成的 URL 是 HTTP，转换为 HTTPS
        if (publicProtocol === 'https:' && url.startsWith('http://')) {
          return url.replace('http://', 'https://');
        }
        return url;
      }
      // 否则替换内网地址为公网地址（使用 publicUrl 的协议）
      return url.replace(currentHost, publicHost);
    }
    return url;
  }
}
