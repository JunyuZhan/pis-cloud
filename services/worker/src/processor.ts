import sharp from 'sharp';
import { encode } from 'blurhash';
import exifReader from 'exif-reader';

export interface ProcessedResult {
  metadata: sharp.Metadata;
  exif: any;
  blurHash: string;
  thumbBuffer: Buffer;
  previewBuffer: Buffer;
}

export interface SingleWatermark {
  id?: string; // 用于UI管理
  type: 'text' | 'logo';
  text?: string;
  logoUrl?: string; // MinIO 或其他可访问的 Logo 图片 URL
  opacity: number; // 0-1
  position: string; // 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  size?: number; // 字体大小或Logo尺寸（可选，自动计算）
  enabled?: boolean; // 单个水印是否启用
}

export interface WatermarkConfig {
  enabled: boolean;
  // 兼容旧格式：单个水印
  type?: 'text' | 'logo';
  text?: string;
  logoUrl?: string;
  opacity?: number;
  position?: string;
  // 新格式：多个水印（最多6个）
  watermarks?: SingleWatermark[];
}

export class PhotoProcessor {
  private image: sharp.Sharp;

  constructor(buffer: Buffer) {
    this.image = sharp(buffer);
  }

  async process(watermarkConfig?: WatermarkConfig): Promise<ProcessedResult> {
    const metadata = await this.image.metadata();
    
    // 1. 提取 EXIF（剥离敏感信息）
    let exif = {};
    if (metadata.exif) {
      try {
        const rawExif = exifReader(metadata.exif);
        // 剥离 GPS 地理位置信息，防止隐私泄露
        exif = this.sanitizeExif(rawExif);
      } catch (e) {
        console.warn('Failed to parse EXIF:', e);
      }
    }

    // 2. 生成 BlurHash
    const blurHash = await this.generateBlurHash();

    // 3. 生成缩略图 (400px)
    const thumbBuffer = await this.image
      .clone()
      .resize(400, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 4. 生成预览图 (2560px)
    let previewPipeline = this.image
      .clone()
      .resize(2560, null, { withoutEnlargement: true });

    // 添加水印
    if (watermarkConfig?.enabled) {
      const { width, height } = await previewPipeline.toBuffer().then(b => sharp(b).metadata());
      
      if (width && height) {
        const composites: Array<{ input: Buffer; gravity: string }> = [];

        // 支持多个水印（新格式）
        if (watermarkConfig.watermarks && Array.isArray(watermarkConfig.watermarks)) {
          // 处理多个水印
          for (const watermark of watermarkConfig.watermarks) {
            if (watermark.enabled === false) continue; // 跳过禁用的水印

            const watermarkBuffer = await this.createWatermarkBuffer(
              watermark,
              width,
              height
            );
            
            if (watermarkBuffer) {
              const gravity = this.positionToGravity(watermark.position);
              composites.push({
                input: watermarkBuffer,
                gravity,
              });
            }
          }
        } else {
          // 兼容旧格式：单个水印
          const singleWatermark: SingleWatermark = {
            type: watermarkConfig.type || 'text',
            text: watermarkConfig.text,
            logoUrl: watermarkConfig.logoUrl,
            opacity: watermarkConfig.opacity || 0.5,
            position: watermarkConfig.position || 'center',
          };

          const watermarkBuffer = await this.createWatermarkBuffer(
            singleWatermark,
            width,
            height
          );

          if (watermarkBuffer) {
            const gravity = this.positionToGravity(singleWatermark.position);
            composites.push({
              input: watermarkBuffer,
              gravity,
            });
          }
        }

        // 应用所有水印
        if (composites.length > 0) {
          previewPipeline = previewPipeline.composite(composites);
        }
      }
    }

    const previewBuffer = await previewPipeline
      .jpeg({ quality: 85 })
      .toBuffer();

    return {
      metadata,
      exif,
      blurHash,
      thumbBuffer,
      previewBuffer,
    };
  }

  /**
   * 创建单个水印的 Buffer
   */
  private async createWatermarkBuffer(
    watermark: SingleWatermark,
    imageWidth: number,
    imageHeight: number
  ): Promise<Buffer | null> {
    if (watermark.type === 'text' && watermark.text) {
      const fontSize = watermark.size || Math.floor(Math.min(imageWidth, imageHeight) * 0.05);
      const { x, y, anchor, baseline } = this.getTextPosition(watermark.position, imageWidth, imageHeight);
      
      const svgText = `
        <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .watermark { fill: rgba(255, 255, 255, ${watermark.opacity}); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
          </style>
          <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" class="watermark">${this.escapeXml(watermark.text)}</text>
        </svg>
      `;
      return Buffer.from(svgText);
    } else if (watermark.type === 'logo' && watermark.logoUrl) {
      try {
        const response = await fetch(watermark.logoUrl);
        if (response.ok) {
          const logoBuffer = await response.arrayBuffer();
          const logoSize = watermark.size || Math.floor(Math.min(imageWidth, imageHeight) * 0.15);

          const resizedLogo = await sharp(Buffer.from(logoBuffer))
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

          const { width: logoW, height: logoH } = await sharp(resizedLogo).metadata();
          if (logoW && logoH) {
            const { x, y } = this.getImagePosition(watermark.position, imageWidth, imageHeight, logoW, logoH);
            const logoBase64 = resizedLogo.toString('base64');

            const svgLogo = `
              <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
                <image
                  href="data:image/png;base64,${logoBase64}"
                  width="${logoW}"
                  height="${logoH}"
                  opacity="${watermark.opacity}"
                  x="${x}"
                  y="${y}"
                />
              </svg>
            `;
            return Buffer.from(svgLogo);
          }
        }
      } catch (e) {
        console.error('Failed to load watermark logo:', e);
      }
    }
    return null;
  }

  /**
   * 将位置字符串转换为 Sharp gravity
   */
  private positionToGravity(position: string): string {
    const positionMap: Record<string, string> = {
      'top-left': 'northwest',
      'top-center': 'north',
      'top-right': 'northeast',
      'center-left': 'west',
      'center': 'center',
      'center-right': 'east',
      'bottom-left': 'southwest',
      'bottom-center': 'south',
      'bottom-right': 'southeast',
      // 兼容旧格式
      'northwest': 'northwest',
      'northeast': 'northeast',
      'southwest': 'southwest',
      'southeast': 'southeast',
    };
    return positionMap[position] || 'center';
  }

  /**
   * 获取文字水印的位置坐标
   */
  private getTextPosition(
    position: string,
    width: number,
    height: number
  ): { x: string; y: string; anchor: string; baseline: string } {
    const margin = Math.min(width, height) * 0.05; // 5% 边距

    const positions: Record<string, { x: string; y: string; anchor: string; baseline: string }> = {
      'top-left': { x: `${margin}`, y: `${margin}`, anchor: 'start', baseline: 'hanging' },
      'top-center': { x: '50%', y: `${margin}`, anchor: 'middle', baseline: 'hanging' },
      'top-right': { x: `${width - margin}`, y: `${margin}`, anchor: 'end', baseline: 'hanging' },
      'center-left': { x: `${margin}`, y: '50%', anchor: 'start', baseline: 'middle' },
      'center': { x: '50%', y: '50%', anchor: 'middle', baseline: 'middle' },
      'center-right': { x: `${width - margin}`, y: '50%', anchor: 'end', baseline: 'middle' },
      'bottom-left': { x: `${margin}`, y: `${height - margin}`, anchor: 'start', baseline: 'alphabetic' },
      'bottom-center': { x: '50%', y: `${height - margin}`, anchor: 'middle', baseline: 'alphabetic' },
      'bottom-right': { x: `${width - margin}`, y: `${height - margin}`, anchor: 'end', baseline: 'alphabetic' },
    };

    return positions[position] || positions['center'];
  }

  /**
   * 获取图片水印的位置坐标
   */
  private getImagePosition(
    position: string,
    imageWidth: number,
    imageHeight: number,
    logoWidth: number,
    logoHeight: number
  ): { x: number; y: number } {
    const margin = Math.min(imageWidth, imageHeight) * 0.05; // 5% 边距

    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: margin, y: margin },
      'top-center': { x: (imageWidth - logoWidth) / 2, y: margin },
      'top-right': { x: imageWidth - logoWidth - margin, y: margin },
      'center-left': { x: margin, y: (imageHeight - logoHeight) / 2 },
      'center': { x: (imageWidth - logoWidth) / 2, y: (imageHeight - logoHeight) / 2 },
      'center-right': { x: imageWidth - logoWidth - margin, y: (imageHeight - logoHeight) / 2 },
      'bottom-left': { x: margin, y: imageHeight - logoHeight - margin },
      'bottom-center': { x: (imageWidth - logoWidth) / 2, y: imageHeight - logoHeight - margin },
      'bottom-right': { x: imageWidth - logoWidth - margin, y: imageHeight - logoHeight - margin },
    };

    return positions[position] || positions['center'];
  }

  /**
   * 转义 XML 特殊字符
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 清理 EXIF 数据，移除敏感信息（GPS 地理位置）
   */
  private sanitizeExif(rawExif: any): any {
    if (!rawExif || typeof rawExif !== 'object') {
      return rawExif;
    }

    const sanitized: any = {};

    // 保留基本 EXIF 信息
    if (rawExif.exif) {
      sanitized.exif = { ...rawExif.exif };
      // 移除可能包含位置信息的字段
      delete sanitized.exif.GPSInfo;
      delete sanitized.exif.GPSVersionID;
    }

    // 保留图像信息
    if (rawExif.image) {
      sanitized.image = rawExif.image;
    }

    // 保留相机信息
    if (rawExif.makernote) {
      sanitized.makernote = rawExif.makernote;
    }

    // 明确移除 GPS 信息
    if (rawExif.gps) {
      // 不保留 GPS 信息
      console.log('[Security] Removed GPS location data from EXIF');
    }

    // 移除所有包含 GPS 的字段
    Object.keys(rawExif).forEach((key) => {
      if (key.toLowerCase().includes('gps') || key.toLowerCase().includes('location')) {
        // 跳过 GPS 相关字段
        return;
      }
      if (!sanitized[key]) {
        sanitized[key] = rawExif[key];
      }
    });

    return sanitized;
  }

  private async generateBlurHash(): Promise<string> {
    const { data, info } = await this.image
      .clone()
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  }
}
