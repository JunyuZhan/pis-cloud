import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinIOAdapter } from './minio-adapter.js'
import type { StorageConfig } from './types.js'

// Mock minio
vi.mock('minio', () => {
  class MockMinioClient {
    getObject = vi.fn()
    putObject = vi.fn().mockResolvedValue({ etag: 'etag', versionId: null })
    presignedPutObject = vi.fn().mockResolvedValue('https://presigned-put-url')
    presignedGetObject = vi.fn().mockResolvedValue('https://presigned-get-url')
    statObject = vi.fn().mockResolvedValue({ size: 1000 })
    removeObject = vi.fn().mockResolvedValue(undefined)
    listObjects = vi.fn().mockReturnValue([])
    listObjectsV2 = vi.fn()
    copyObject = vi.fn().mockResolvedValue(undefined)
  }
  
  return {
    default: {
      Client: MockMinioClient,
    },
    Client: MockMinioClient,
  }
})

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = vi.fn()
  }
  return {
    S3Client: MockS3Client,
    CreateMultipartUploadCommand: vi.fn(),
    UploadPartCommand: vi.fn(),
    CompleteMultipartUploadCommand: vi.fn(),
    AbortMultipartUploadCommand: vi.fn(),
    CopyObjectCommand: vi.fn(),
  }
})

describe('MinIOAdapter', () => {
  const baseConfig: StorageConfig = {
    type: 'minio',
    endpoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'test-key',
    secretKey: 'test-secret',
    bucket: 'test-bucket',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create MinIO adapter with config', () => {
      const adapter = new MinIOAdapter(baseConfig)
      expect(adapter).toBeDefined()
    })

    it('should create presign client with public URL', () => {
      const config: StorageConfig = {
        ...baseConfig,
        customConfig: {
          publicUrl: 'https://public.example.com',
        },
      }
      const adapter = new MinIOAdapter(config)
      expect(adapter).toBeDefined()
    })

    it('should handle invalid public URL', () => {
      const config: StorageConfig = {
        ...baseConfig,
        customConfig: {
          publicUrl: 'invalid-url',
        },
      }
      // 应该回退到内网客户端
      const adapter = new MinIOAdapter(config)
      expect(adapter).toBeDefined()
    })
  })

  describe('download', () => {
    it('should download file', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const Minio = await import('minio')
      const ClientConstructor = Minio.default.Client as any
      // 获取 adapter 内部创建的 client 实例
      const adapterClient = (adapter as any).client as any
      
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('test')), 0)
          }
          if (event === 'end') {
            setTimeout(() => callback(), 0)
          }
          return mockStream
        }),
      }
      adapterClient.getObject.mockReturnValue(mockStream)

      const buffer = await adapter.download('test-key')
      expect(buffer).toBeInstanceOf(Buffer)
    })
  })

  describe('upload', () => {
    it('should upload file', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const buffer = Buffer.from('test')
      const result = await adapter.upload('test-key', buffer, { 'Content-Type': 'image/jpeg' })

      expect(result).toHaveProperty('etag')
    })
  })

  describe('getPresignedPutUrl', () => {
    it('should get presigned put URL', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const url = await adapter.getPresignedPutUrl('test-key', 3600)
      expect(url).toBe('https://presigned-put-url')
    })
  })

  describe('getPresignedGetUrl', () => {
    it('should get presigned get URL', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const url = await adapter.getPresignedGetUrl('test-key', 3600)
      expect(url).toBe('https://presigned-get-url')
    })

    it('should transform URL with publicUrl', async () => {
      const config: StorageConfig = {
        ...baseConfig,
        customConfig: {
          publicUrl: 'https://public.example.com:9000',
        },
      }
      const adapter = new MinIOAdapter(config)
      const Minio = await import('minio')
      const adapterPresignClient = (adapter as any).presignClient as any
      adapterPresignClient.presignedGetObject.mockResolvedValue('http://localhost:9000/presigned-url')
      
      const url = await adapter.getPresignedGetUrl('test-key', 3600)
      expect(url).toContain('public.example.com')
    })
  })

  describe('exists', () => {
    it('should return true if object exists', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      adapterClient.statObject.mockResolvedValue({ size: 1000 })
      
      const exists = await adapter.exists('test-key')
      expect(exists).toBe(true)
    })

    it('should return false if object does not exist', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      adapterClient.statObject.mockRejectedValue(new Error('Not found'))
      
      const exists = await adapter.exists('test-key')
      expect(exists).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete object', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      
      await adapter.delete('test-key')
      expect(adapterClient.removeObject).toHaveBeenCalledWith('test-bucket', 'test-key')
    })
  })

  describe('listObjects', () => {
    it('should list objects', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback({ name: 'test-key-1', size: 1000, lastModified: new Date(), etag: 'etag1' })
              callback({ name: 'test-key-2', size: 2000, lastModified: new Date(), etag: 'etag2' })
            }, 0)
          }
          if (event === 'end') {
            setTimeout(() => callback(), 0)
          }
          return mockStream
        }),
      }
      adapterClient.listObjectsV2.mockReturnValue(mockStream)
      
      const objects = await adapter.listObjects('prefix/')
      expect(objects).toHaveLength(2)
      expect(objects[0].key).toBe('test-key-1')
    })

    it('should handle stream error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Stream error')), 0)
          }
          return mockStream
        }),
      }
      adapterClient.listObjectsV2.mockReturnValue(mockStream)
      
      await expect(adapter.listObjects('prefix/')).rejects.toThrow('Stream error')
    })
  })

  describe('copy', () => {
    it('should copy object', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      
      await adapter.copy('src-key', 'dest-key')
      expect(adapterClient.copyObject).toHaveBeenCalledWith('test-bucket', 'dest-key', '/test-bucket/src-key')
    })

    it('should handle copy error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      adapterClient.copyObject.mockRejectedValue(new Error('Copy failed'))
      
      await expect(adapter.copy('src-key', 'dest-key')).rejects.toThrow('Failed to copy object')
    })
  })

  describe('initMultipartUpload', () => {
    it('should initiate multipart upload', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const { S3Client, CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3')
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({ UploadId: 'upload-id-123' })
      
      const uploadId = await adapter.initMultipartUpload('test-key')
      expect(uploadId).toBe('upload-id-123')
      expect(CreateMultipartUploadCommand).toHaveBeenCalled()
    })

    it('should handle missing upload ID', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({ UploadId: null })
      
      await expect(adapter.initMultipartUpload('test-key')).rejects.toThrow('Failed to initiate multipart upload')
    })

    it('should handle error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockRejectedValue(new Error('S3 error'))
      
      await expect(adapter.initMultipartUpload('test-key')).rejects.toThrow('Failed to initiate multipart upload')
    })
  })

  describe('uploadPart', () => {
    it('should upload part', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const { UploadPartCommand } = await import('@aws-sdk/client-s3')
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({ ETag: '"etag-123"' })
      
      const result = await adapter.uploadPart('test-key', 'upload-id', 1, Buffer.from('data'))
      expect(result.etag).toBe('etag-123')
      expect(UploadPartCommand).toHaveBeenCalled()
    })

    it('should handle missing ETag', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({ ETag: null })
      
      await expect(adapter.uploadPart('test-key', 'upload-id', 1, Buffer.from('data'))).rejects.toThrow('Failed to upload part')
    })

    it('should handle error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockRejectedValue(new Error('Upload error'))
      
      await expect(adapter.uploadPart('test-key', 'upload-id', 1, Buffer.from('data'))).rejects.toThrow('Failed to upload part')
    })
  })

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const { CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3')
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({})
      
      await adapter.completeMultipartUpload('test-key', 'upload-id', [
        { partNumber: 1, etag: 'etag1' },
        { partNumber: 2, etag: 'etag2' },
      ])
      
      expect(CompleteMultipartUploadCommand).toHaveBeenCalled()
      const commandCall = (CompleteMultipartUploadCommand as any).mock.calls[0][0]
      expect(commandCall.MultipartUpload.Parts[0].ETag).toBe('"etag1"')
      expect(commandCall.MultipartUpload.Parts[1].ETag).toBe('"etag2"')
    })

    it('should handle parts with existing quotes', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({})
      
      await adapter.completeMultipartUpload('test-key', 'upload-id', [
        { partNumber: 1, etag: '"etag1"' },
      ])
      
      const { CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3')
      const commandCall = (CompleteMultipartUploadCommand as any).mock.calls[0][0]
      expect(commandCall.MultipartUpload.Parts[0].ETag).toBe('"etag1"')
    })

    it('should handle error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockRejectedValue(new Error('Complete error'))
      
      await expect(adapter.completeMultipartUpload('test-key', 'upload-id', [
        { partNumber: 1, etag: 'etag1' },
      ])).rejects.toThrow('Failed to complete multipart upload')
    })
  })

  describe('abortMultipartUpload', () => {
    it('should abort multipart upload', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const { AbortMultipartUploadCommand } = await import('@aws-sdk/client-s3')
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockResolvedValue({})
      
      await adapter.abortMultipartUpload('test-key', 'upload-id')
      
      expect(AbortMultipartUploadCommand).toHaveBeenCalled()
    })

    it('should handle error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterS3Client = (adapter as any).s3Client as any
      
      adapterS3Client.send.mockRejectedValue(new Error('Abort error'))
      
      await expect(adapter.abortMultipartUpload('test-key', 'upload-id')).rejects.toThrow('Failed to abort multipart upload')
    })
  })

  describe('constructor edge cases', () => {
    it('should create adapter with SSL', () => {
      const config: StorageConfig = {
        ...baseConfig,
        useSSL: true,
        port: 443,
      }
      const adapter = new MinIOAdapter(config)
      expect(adapter).toBeDefined()
    })

    it('should create adapter with region', () => {
      const config: StorageConfig = {
        ...baseConfig,
        region: 'us-west-2',
      }
      const adapter = new MinIOAdapter(config)
      expect(adapter).toBeDefined()
    })

    it('should create adapter with public URL port', () => {
      const config: StorageConfig = {
        ...baseConfig,
        customConfig: {
          publicUrl: 'https://public.example.com:8443',
        },
      }
      const adapter = new MinIOAdapter(config)
      expect(adapter).toBeDefined()
    })

    it('should handle download stream error', async () => {
      const adapter = new MinIOAdapter(baseConfig)
      const adapterClient = (adapter as any).client as any
      
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Stream error')), 0)
          }
          return mockStream
        }),
      }
      adapterClient.getObject.mockReturnValue(mockStream)
      
      await expect(adapter.download('test-key')).rejects.toThrow('Stream error')
    })
  })
})
