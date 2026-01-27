import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createStorageAdapter,
  getStorageAdapter,
  downloadFile,
  uploadFile,
  getPresignedPutUrl,
  getPresignedGetUrl,
  initMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  listObjects,
  copyFile,
  deleteFile,
  getMinioClient,
  bucketName,
} from './index.js'

// Mock adapters
const createMockAdapter = () => ({
  download: vi.fn().mockResolvedValue(Buffer.from('test')),
  upload: vi.fn().mockResolvedValue(undefined),
  getPresignedPutUrl: vi.fn().mockResolvedValue('https://presigned-put-url'),
  getPresignedGetUrl: vi.fn().mockResolvedValue('https://presigned-get-url'),
  initMultipartUpload: vi.fn().mockResolvedValue('upload-id'),
  uploadPart: vi.fn().mockResolvedValue({ etag: 'etag-1' }),
  completeMultipartUpload: vi.fn().mockResolvedValue(undefined),
  abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
  listObjects: vi.fn().mockResolvedValue([]),
  copy: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
})

let mockAdapterInstance: ReturnType<typeof createMockAdapter>

vi.mock('./minio-adapter.js', () => ({
  MinIOAdapter: class {
    constructor() {
      mockAdapterInstance = createMockAdapter()
      return mockAdapterInstance
    }
  },
}))

vi.mock('./oss-adapter.js', () => ({
  OSSAdapter: class {
    constructor() {
      mockAdapterInstance = createMockAdapter()
      return mockAdapterInstance
    }
  },
}))

vi.mock('./cos-adapter.js', () => ({
  COSAdapter: class {
    constructor() {
      mockAdapterInstance = createMockAdapter()
      return mockAdapterInstance
    }
  },
}))

describe('storage/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.STORAGE_TYPE
    delete process.env.STORAGE_ENDPOINT
    delete process.env.MINIO_ENDPOINT_HOST
  })

  describe('createStorageAdapter', () => {
    it('should create MinIO adapter by default', () => {
      const adapter = createStorageAdapter()
      expect(adapter).toBeDefined()
    })

    it('should create MinIO adapter with config', () => {
      const adapter = createStorageAdapter({
        type: 'minio',
        endpoint: 'localhost',
        accessKey: 'key',
        secretKey: 'secret',
        bucket: 'test-bucket',
      })
      expect(adapter).toBeDefined()
    })

    it('should create OSS adapter', () => {
      const adapter = createStorageAdapter({
        type: 'oss',
        endpoint: 'oss.example.com',
        accessKey: 'key',
        secretKey: 'secret',
        bucket: 'test-bucket',
      })
      expect(adapter).toBeDefined()
    })

    it('should create COS adapter', () => {
      const adapter = createStorageAdapter({
        type: 'cos',
        endpoint: 'cos.example.com',
        accessKey: 'key',
        secretKey: 'secret',
        bucket: 'test-bucket',
      })
      expect(adapter).toBeDefined()
    })

    it('should create S3 adapter using MinIO', () => {
      const adapter = createStorageAdapter({
        type: 's3',
        region: 'us-east-1',
        accessKey: 'key',
        secretKey: 'secret',
        bucket: 'test-bucket',
      })
      expect(adapter).toBeDefined()
    })

    it('should throw error for unsupported type', () => {
      expect(() => {
        createStorageAdapter({
          type: 'unsupported' as any,
        })
      }).toThrow('Unsupported storage type: unsupported')
    })
  })

  describe('getStorageAdapter', () => {
    it('should return singleton adapter', () => {
      const adapter1 = getStorageAdapter()
      const adapter2 = getStorageAdapter()
      expect(adapter1).toBe(adapter2)
    })
  })

  describe('downloadFile', () => {
    it('should download file', async () => {
      const buffer = await downloadFile('test-key')
      expect(buffer).toBeInstanceOf(Buffer)
      expect(mockAdapterInstance.download).toHaveBeenCalledWith('test-key')
    })
  })

  describe('uploadFile', () => {
    it('should upload file', async () => {
      await uploadFile('test-key', Buffer.from('test'), { 'Content-Type': 'image/jpeg' })
      expect(mockAdapterInstance.upload).toHaveBeenCalledWith('test-key', Buffer.from('test'), {
        'Content-Type': 'image/jpeg',
      })
    })
  })

  describe('getPresignedPutUrl', () => {
    it('should get presigned put URL', async () => {
      const url = await getPresignedPutUrl('test-key', 3600)
      expect(url).toBe('https://presigned-put-url')
      expect(mockAdapterInstance.getPresignedPutUrl).toHaveBeenCalledWith('test-key', 3600)
    })
  })

  describe('getPresignedGetUrl', () => {
    it('should get presigned get URL', async () => {
      const url = await getPresignedGetUrl('test-key', 3600)
      expect(url).toBe('https://presigned-get-url')
      expect(mockAdapterInstance.getPresignedGetUrl).toHaveBeenCalledWith('test-key', 3600)
    })
  })

  describe('initMultipartUpload', () => {
    it('should init multipart upload', async () => {
      const uploadId = await initMultipartUpload('test-key')
      expect(uploadId).toBe('upload-id')
      expect(mockAdapterInstance.initMultipartUpload).toHaveBeenCalledWith('test-key')
    })
  })

  describe('uploadPart', () => {
    it('should upload part', async () => {
      const result = await uploadPart('test-key', 'upload-id', 1, Buffer.from('part'))
      expect(result.etag).toBe('etag-1')
      expect(mockAdapterInstance.uploadPart).toHaveBeenCalledWith('test-key', 'upload-id', 1, Buffer.from('part'))
    })
  })

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload', async () => {
      await completeMultipartUpload('test-key', 'upload-id', [
        { partNumber: 1, etag: 'etag-1' },
      ])
      expect(mockAdapterInstance.completeMultipartUpload).toHaveBeenCalledWith(
        'test-key',
        'upload-id',
        [{ partNumber: 1, etag: 'etag-1' }]
      )
    })
  })

  describe('abortMultipartUpload', () => {
    it('should abort multipart upload', async () => {
      await abortMultipartUpload('test-key', 'upload-id')
      expect(mockAdapterInstance.abortMultipartUpload).toHaveBeenCalledWith('test-key', 'upload-id')
    })
  })

  describe('listObjects', () => {
    it('should list objects', async () => {
      await listObjects('prefix/')
      expect(mockAdapterInstance.listObjects).toHaveBeenCalledWith('prefix/')
    })
  })

  describe('copyFile', () => {
    it('should copy file', async () => {
      await copyFile('src-key', 'dest-key')
      expect(mockAdapterInstance.copy).toHaveBeenCalledWith('src-key', 'dest-key')
    })
  })

  describe('deleteFile', () => {
    it('should delete file', async () => {
      await deleteFile('test-key')
      expect(mockAdapterInstance.delete).toHaveBeenCalledWith('test-key')
    })
  })

  describe('getMinioClient', () => {
    it('should return storage adapter for backward compatibility', () => {
      const client = getMinioClient()
      expect(client).toBeDefined()
    })
  })

  describe('bucketName', () => {
    it('should have default bucket name', () => {
      expect(bucketName).toBeDefined()
    })
  })
})
