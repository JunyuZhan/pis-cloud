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

export interface WatermarkConfig {
  enabled: boolean;
  type: 'text' | 'logo';
  text?: string;
  opacity: number;
  position: string; // 'center' | 'southeast' | ...
}

export class PhotoProcessor {
  private image: sharp.Sharp;

  constructor(buffer: Buffer) {
    this.image = sharp(buffer);
  }

  async process(watermarkConfig?: WatermarkConfig): Promise<ProcessedResult> {
    const metadata = await this.image.metadata();
    
    // 1. 提取 EXIF
    let exif = {};
    if (metadata.exif) {
      try {
        exif = exifReader(metadata.exif);
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
    if (watermarkConfig?.enabled && watermarkConfig.type === 'text' && watermarkConfig.text) {
      const { width, height } = await previewPipeline.toBuffer().then(b => sharp(b).metadata());
      
      if (width && height) {
        const fontSize = Math.floor(Math.min(width, height) * 0.05); // 字体大小为最小边长的 5%
        const svgText = `
          <svg width="${width}" height="${height}">
            <style>
              .title { fill: rgba(255, 255, 255, ${watermarkConfig.opacity}); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
            </style>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="title">${watermarkConfig.text}</text>
          </svg>
        `;

        let gravity = 'center';
        switch (watermarkConfig.position) {
          case 'southeast': gravity = 'southeast'; break;
          case 'southwest': gravity = 'southwest'; break;
          case 'northeast': gravity = 'northeast'; break;
          case 'northwest': gravity = 'northwest'; break;
          case 'center': default: gravity = 'center'; break;
        }

        previewPipeline = previewPipeline.composite([
          {
            input: Buffer.from(svgText),
            gravity: gravity as any,
          },
        ]);
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
