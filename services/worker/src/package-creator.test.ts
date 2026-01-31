import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PackageCreator } from './package-creator.js'

// Mock dependencies
vi.mock('./lib/storage/index.js', () => ({
  downloadFile: vi.fn().mockResolvedValue(Buffer.from('image-data')),
}))

vi.mock('./processor.js', () => ({
  PhotoProcessor: class {
    constructor(buffer: Buffer) {}
    async process() {
      return {
        metadata: { width: 1000, height: 1000 },
        exif: {},
        blurHash: 'hash',
        thumbBuffer: Buffer.from('thumb'),
        previewBuffer: Buffer.from('preview'),
      }
    }
  },
}))

// Mock archiver
vi.mock('archiver', () => {
  const mockArchive = {
    on: vi.fn((event, callback) => {
      if (event === 'end') {
        setTimeout(() => callback(), 0)
      }
      return mockArchive
    }),
    append: vi.fn(),
    finalize: vi.fn(),
  }
  
  return {
    default: vi.fn().mockReturnValue(mockArchive),
  }
})

describe('PackageCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPackage', () => {
    it('should throw error if no photos provided', async () => {
      await expect(
        PackageCreator.createPackage({
          photos: [],
          albumId: 'album-1',
          includeWatermarked: true,
          includeOriginal: false,
        })
      ).rejects.toThrow('No photos provided for packaging')
    })

    it('should throw error if neither includeWatermarked nor includeOriginal is true', async () => {
      await expect(
        PackageCreator.createPackage({
          photos: [{ id: '1', filename: 'test.jpg', originalKey: 'original/1.jpg' }],
          albumId: 'album-1',
          includeWatermarked: false,
          includeOriginal: false,
        })
      ).rejects.toThrow('At least one of includeWatermarked or includeOriginal must be true')
    })

    it('should create package with original photos', async () => {
      const { downloadFile } = await import('./lib/storage/index.js')
      const archiver = await import('archiver')
      // archiver.default 是一个 mock 函数，调用它会返回 mockArchive
      const mockArchiveInstance = archiver.default() as any
      
      const buffer = await PackageCreator.createPackage({
        photos: [
          { id: '1', filename: 'test1.jpg', originalKey: 'original/1.jpg' },
          { id: '2', filename: 'test2.jpg', originalKey: 'original/2.jpg' },
        ],
        albumId: 'album-1',
        includeWatermarked: false,
        includeOriginal: true,
      })

      expect(buffer).toBeInstanceOf(Buffer)
      expect(downloadFile).toHaveBeenCalled()
      expect(mockArchiveInstance.append).toHaveBeenCalled()
    })

    it('should create package with watermarked photos', async () => {
      const buffer = await PackageCreator.createPackage({
        photos: [
          {
            id: '1',
            filename: 'test1.jpg',
            originalKey: 'original/1.jpg',
            previewKey: 'preview/1.jpg',
          },
        ],
        albumId: 'album-1',
        includeWatermarked: true,
        includeOriginal: false,
        watermarkConfig: {
          enabled: true,
          type: 'text',
          text: 'Watermark',
        },
      })

      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('should handle preview key when creating watermarked package', async () => {
      const { downloadFile } = await import('./lib/storage/index.js')
      
      await PackageCreator.createPackage({
        photos: [
          {
            id: '1',
            filename: 'test1.jpg',
            originalKey: 'original/1.jpg',
            previewKey: 'preview/1.jpg',
          },
        ],
        albumId: 'album-1',
        includeWatermarked: true,
        includeOriginal: false,
        watermarkConfig: {
          enabled: true,
        },
      })

      // 应该下载 preview key 而不是处理原图
      expect(downloadFile).toHaveBeenCalledWith('preview/1.jpg')
    })
  })
})
