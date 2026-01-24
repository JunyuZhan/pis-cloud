/**
 * 腾讯云 COS 存储适配器
 * COS 兼容 S3 API，使用 MinIO SDK（S3 兼容模式）
 */
import * as Minio from 'minio';
import type { StorageAdapter, StorageConfig, UploadResult } from './types.js';

export class COSAdapter implements StorageAdapter {
  private client: Minio.Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.customConfig?.publicUrl;

    // 腾讯云 COS 使用 S3 兼容 API
    // endpoint 格式: cos.ap-guangzhou.myqcloud.com
    const endpoint = config.endpoint || '';
    const isCustomDomain = endpoint.includes('.myqcloud.com') || endpoint.includes('.cos.');

    this.client = new Minio.Client({
      endPoint: isCustomDomain 
        ? endpoint 
        : `cos.${config.region || 'ap-guangzhou'}.myqcloud.com`,
      port: config.port || (config.useSSL ? 443 : 80),
      useSSL: config.useSSL ?? true, // COS 默认使用 HTTPS
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region || 'ap-guangzhou',
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
      url: this.publicUrl ? `${this.publicUrl}/${key}` : undefined,
    };
  }

  async getPresignedPutUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    const url = await this.client.presignedPutObject(
      this.bucket,
      key,
      expirySeconds
    );
    return this.toPublicUrl(url);
  }

  async getPresignedGetUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    const url = await this.client.presignedGetObject(
      this.bucket,
      key,
      expirySeconds
    );
    return this.toPublicUrl(url);
  }

  async initMultipartUpload(key: string): Promise<string> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.initiateNewMultipartUpload(
        this.bucket,
        key,
        {},
        (err: Error, uploadId: string) => {
          if (err) reject(err);
          else resolve(uploadId);
        }
      );
    });
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.uploadPart(
        {
          bucketName: this.bucket,
          objectName: key,
          uploadId,
          partNumber,
          headers: {},
        },
        buffer,
        (err: Error, etag: string) => {
          if (err) reject(err);
          else resolve({ etag });
        }
      );
    });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.completeMultipartUpload(
        this.bucket,
        key,
        uploadId,
        parts,
        (err: Error) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.abortMultipartUpload(
        this.bucket,
        key,
        uploadId,
        (err: Error) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
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

  private toPublicUrl(url: string): string {
    if (!this.publicUrl) return url;
    const match = url.match(/https?:\/\/([^\/]+)/);
    if (match) {
      return url.replace(match[0], this.publicUrl);
    }
    return url;
  }
}
