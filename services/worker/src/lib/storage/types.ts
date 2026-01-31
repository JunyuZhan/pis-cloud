/**
 * 存储抽象层类型定义
 * 支持多种对象存储：MinIO、阿里云 OSS、腾讯云 COS、AWS S3 等
 */

export interface StorageConfig {
  type: 'minio' | 'oss' | 'cos' | 's3' | 'custom';
  endpoint?: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string; // OSS/COS/S3 需要
  // 自定义配置
  customConfig?: Record<string, any>;
}

export interface UploadResult {
  etag: string;
  versionId?: string | null;
  url?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export interface StorageAdapter {
  /**
   * 下载文件
   */
  download(key: string): Promise<Buffer>;
  
  /**
   * 上传文件
   */
  upload(
    key: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<UploadResult>;
  
  /**
   * 生成预签名上传 URL
   */
  getPresignedPutUrl(key: string, expirySeconds?: number): Promise<string>;
  
  /**
   * 生成预签名下载 URL
   */
  getPresignedGetUrl(key: string, expirySeconds?: number): Promise<string>;
  
  /**
   * 初始化分片上传
   */
  initMultipartUpload(key: string): Promise<string>;
  
  /**
   * 上传分片
   */
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }>;
  
  /**
   * 生成分片的预签名上传 URL（用于客户端直接上传到存储）
   */
  getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds?: number
  ): Promise<string>;
  
  /**
   * 完成分片上传
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void>;
  
  /**
   * 取消分片上传
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  
  /**
   * 删除文件
   */
  delete(key: string): Promise<void>;
  
  /**
   * 检查文件是否存在
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * 列出指定前缀下的所有对象
   * @param prefix 前缀路径，如 "sync/album-uuid/"
   * @returns 对象列表
   */
  listObjects(prefix: string): Promise<StorageObject[]>;
  
  /**
   * 复制对象（用于移动文件）
   * @param srcKey 源路径
   * @param destKey 目标路径
   */
  copy(srcKey: string, destKey: string): Promise<void>;
}
