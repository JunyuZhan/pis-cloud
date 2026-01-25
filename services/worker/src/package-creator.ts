import archiver from 'archiver';
import { downloadFile } from './lib/storage/index.js';
import { PhotoProcessor } from './processor.js';

export interface PackageOptions {
  photos: Array<{
    id: string;
    filename: string;
    originalKey: string;
    previewKey?: string | null;
  }>;
  albumId: string;
  watermarkConfig?: {
    enabled: boolean;
    type?: 'text' | 'logo';
    watermarks?: Array<{
      type: 'text' | 'logo';
      text?: string;
      logoUrl?: string;
      opacity: number;
      position: string;
      enabled?: boolean;
    }>;
    [key: string]: any;
  };
  includeWatermarked: boolean;
  includeOriginal: boolean;
}

/**
 * 创建照片打包 ZIP 文件
 * 支持有水印和无水印两个版本
 */
export class PackageCreator {
  /**
   * 创建 ZIP 文件 Buffer
   */
  static async createPackage(options: PackageOptions): Promise<Buffer> {
    const { photos, watermarkConfig, includeWatermarked, includeOriginal } = options;
    
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }, // 最高压缩级别
      });

      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // 处理每张照片
      (async () => {
        try {
          for (const photo of photos) {
            try {
              // 下载原图
              const originalBuffer = await downloadFile(photo.originalKey);

              if (includeOriginal) {
                // 添加原图（无水印版本）
                archive.append(originalBuffer, {
                  name: `无水印/${photo.filename}`,
                });
              }

              if (includeWatermarked) {
                let watermarkedBuffer: Buffer;
                
                if (watermarkConfig?.enabled) {
                  // 如果有预览图且启用了水印，优先使用预览图（已处理过水印）
                  if (photo.previewKey) {
                    try {
                      watermarkedBuffer = await downloadFile(photo.previewKey);
                    } catch {
                      // 如果预览图不存在，重新处理添加水印
                      const processor = new PhotoProcessor(originalBuffer);
                      const result = await processor.process(watermarkConfig);
                      watermarkedBuffer = result.previewBuffer;
                    }
                  } else {
                    // 重新处理添加水印
                    const processor = new PhotoProcessor(originalBuffer);
                    const result = await processor.process(watermarkConfig);
                    watermarkedBuffer = result.previewBuffer;
                  }
                } else {
                  // 如果相册没有启用水印，使用原图
                  watermarkedBuffer = originalBuffer;
                }

                // 添加水印版本
                archive.append(watermarkedBuffer, {
                  name: `有水印/${photo.filename}`,
                });
              }
            } catch (err) {
              console.error(`Failed to process photo ${photo.id}:`, err);
              // 继续处理其他照片，不中断整个打包过程
            }
          }
          
          // 所有照片处理完成后，完成归档
          archive.finalize();
        } catch (err) {
          archive.abort();
          reject(err);
        }
      })();
    });
  }
}
