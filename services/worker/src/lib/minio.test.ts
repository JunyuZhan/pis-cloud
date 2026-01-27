import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock minio
vi.mock('minio', () => {
  class MockMinioClient {
    getObject = vi.fn()
    putObject = vi.fn().mockResolvedValue({ etag: 'etag', versionId: null })
    presignedPutObject = vi.fn().mockResolvedValue('https://presigned-put-url')
    presignedGetObject = vi.fn().mockResolvedValue('https://presigned-get-url')
    initiateNewMultipartUpload = vi.fn()
    uploadPart = vi.fn()
    completeMultipartUpload = vi.fn()
    abortMultipartUpload = vi.fn()
  }
  
  return {
    default: {
      Client: MockMinioClient,
    },
    Client: MockMinioClient,
  }
})

describe('minio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('bucketName', () => {
    it('should have default bucket name', async () => {
      const { bucketName } = await import('./minio.js')
      expect(bucketName).toBeDefined()
    })

    it('should use environment variable', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        MINIO_BUCKET: 'custom-bucket',
      }

      vi.resetModules()
      const { bucketName: newBucketName } = await import('./minio.js')
      expect(newBucketName).toBe('custom-bucket')

      process.env = originalEnv
    })
  })

  describe('getMinioClient', () => {
    it('should return MinIO client', async () => {
      const { getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      expect(client).toBeDefined()
    })
  })

  describe('downloadFile', () => {
    it('should download file', async () => {
      const { downloadFile, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
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
      mockClient.getObject.mockReturnValue(mockStream)

      const buffer = await downloadFile('test-key')
      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('should handle download errors', async () => {
      const { downloadFile, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Download error')), 0)
          }
          return mockStream
        }),
      }
      mockClient.getObject.mockReturnValue(mockStream)

      await expect(downloadFile('test-key')).rejects.toThrow('Download error')
    })
  })

  describe('uploadFile', () => {
    it('should upload file', async () => {
      const { uploadFile } = await import('./minio.js')
      const buffer = Buffer.from('test')
      const result = await uploadFile('test-key', buffer, { 'Content-Type': 'image/jpeg' })

      expect(result).toHaveProperty('etag')
    })
  })

  describe('uploadBuffer', () => {
    it('should be alias of uploadFile', async () => {
      const { uploadBuffer, uploadFile } = await import('./minio.js')
      expect(uploadBuffer).toBe(uploadFile)
    })
  })

  describe('getPresignedPutUrl', () => {
    it('should get presigned put URL', async () => {
      const { getPresignedPutUrl } = await import('./minio.js')
      const url = await getPresignedPutUrl('test-key', 3600)
      expect(url).toBe('https://presigned-put-url')
    })
  })

  describe('getPresignedGetUrl', () => {
    it('should get presigned get URL', async () => {
      const { getPresignedGetUrl } = await import('./minio.js')
      const url = await getPresignedGetUrl('test-key', 3600)
      expect(url).toBe('https://presigned-get-url')
    })
  })

  describe('initMultipartUpload', () => {
    it('should init multipart upload', async () => {
      const { initMultipartUpload, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      mockClient.initiateNewMultipartUpload.mockImplementation((bucket: string, key: string, meta: any, callback: any) => {
        callback(null, 'upload-id')
      })

      const uploadId = await initMultipartUpload('test-key')
      expect(uploadId).toBe('upload-id')
    })

    it('should handle errors', async () => {
      const { initMultipartUpload, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      mockClient.initiateNewMultipartUpload.mockImplementation((bucket: string, key: string, meta: any, callback: any) => {
        callback(new Error('Init error'), null)
      })

      await expect(initMultipartUpload('test-key')).rejects.toThrow('Init error')
    })
  })

  describe('uploadPart', () => {
    it('should upload part', async () => {
      const { uploadPart, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      mockClient.uploadPart.mockImplementation((options: any, buffer: Buffer, callback: any) => {
        callback(null, 'etag-1')
      })

      const result = await uploadPart('test-key', 'upload-id', 1, Buffer.from('part'))
      expect(result.etag).toBe('etag-1')
    })
  })

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload', async () => {
      const { completeMultipartUpload, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      mockClient.completeMultipartUpload.mockImplementation((bucket: string, key: string, uploadId: string, parts: any[], callback: any) => {
        callback(null)
      })

      await expect(
        completeMultipartUpload('test-key', 'upload-id', [
          { partNumber: 1, etag: 'etag-1' },
        ])
      ).resolves.toBeUndefined()
    })
  })

  describe('abortMultipartUpload', () => {
    it('should abort multipart upload', async () => {
      const { abortMultipartUpload, getMinioClient } = await import('./minio.js')
      const client = getMinioClient()
      const mockClient = client as any
      
      mockClient.abortMultipartUpload.mockImplementation((bucket: string, key: string, uploadId: string, callback: any) => {
        callback(null)
      })

      await expect(abortMultipartUpload('test-key', 'upload-id')).resolves.toBeUndefined()
    })
  })
})
