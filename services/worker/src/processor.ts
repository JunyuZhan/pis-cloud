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
  logoUrl?: string; // MinIO 或其他可访问的 Logo 图片 URL
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
    if (watermarkConfig?.enabled) {
      const { width, height } = await previewPipeline.toBuffer().then(b => sharp(b).metadata());
      
      if (width && height) {
        let watermarkBuffer: Buffer | null = null;
        let gravity = 'center';

        // 确定位置
        switch (watermarkConfig.position) {
          case 'southeast': gravity = 'southeast'; break;
          case 'southwest': gravity = 'southwest'; break;
          case 'northeast': gravity = 'northeast'; break;
          case 'northwest': gravity = 'northwest'; break;
          case 'center': default: gravity = 'center'; break;
        }

        // 处理文字水印
        if (watermarkConfig.type === 'text' && watermarkConfig.text) {
          const fontSize = Math.floor(Math.min(width, height) * 0.05); // 5%
          const svgText = `
            <svg width="${width}" height="${height}">
              <style>
                .title { fill: rgba(255, 255, 255, ${watermarkConfig.opacity}); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
              </style>
              <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="title">${watermarkConfig.text}</text>
            </svg>
          `;
          watermarkBuffer = Buffer.from(svgText);
        }
        // 处理 Logo 水印
        else if (watermarkConfig.type === 'logo' && watermarkConfig.logoUrl) {
          try {
            const response = await fetch(watermarkConfig.logoUrl);
            if (response.ok) {
              const logoBuffer = await response.arrayBuffer();
              const logoSize = Math.floor(Math.min(width, height) * 0.15); // Logo 占 15%

              // 调整 Logo 大小和透明度
              // 注意: sharp 的 ensureAlpha() 和 composite() 对于透明度处理
              // 这里我们使用 svg 来包装图片以应用透明度，或者使用 sharp 处理
              // 为简单起见，这里假设 logo 是 png，我们调整大小并应用整体透明度
              // sharp 调整透明度比较麻烦，通常通过 modulate 或 composite 时的 blend 选项
              // 但最可靠的是 SVG 包装

              // 简化方案：先 resize logo
              const resizedLogo = await sharp(Buffer.from(logoBuffer))
                .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer();
              
              // 使用 SVG 包装以应用透明度
              const { width: logoW, height: logoH } = await sharp(resizedLogo).metadata();
              if (logoW && logoH) {
                 const svgLogo = `
                  <svg width="${width}" height="${height}">
                    <image 
                      href="data:image/png;base64,${resizedLogo.toString('base64')}" 
                      x="${gravity.includes('west') || gravity === 'center' ? '5%' : (width - logoW - width * 0.05)}" 
                      y="${gravity.includes('north') || gravity === 'center' ? '5%' : (height - logoH - height * 0.05)}" 
                      width="${logoW}" 
                      height="${logoH}" 
                      opacity="${watermarkConfig.opacity}"
                    />
                  </svg>
                `;
                 // 对于 SVG 覆盖，gravity 设为 center 即可，因为坐标在 SVG 内部控制
                 // 但为了复用下面的逻辑，我们这里稍微 hack 一下，或者直接用 buffer
                 // 更好的方式：
                 // 1. resize logo
                 // 2. ensure alpha
                 // 3. composite with opacity (sharp v0.33+ support opacity in composite options, but here we might be on older version)
                 // Let's stick to the SVG wrapper for consistency if text works well, 
                 // BUT for simplicity in this MVP, let's just composite the resized logo directly
                 // and ignore opacity for now if complex, OR use the ensureAlpha channel manipulation.
                 
                 // 修正：使用 removeAlpha().ensureAlpha(opacity) 在旧版 sharp 不行
                 // 让我们尝试使用 composite 的 blend 模式或 input options
                 
                 // 最终方案：调整 Logo 大小后直接合成。透明度暂不支持（除非 Logo 本身半透明），
                 // 或者使用 SVG 包装方案（更通用）。
                 
                 // 使用 SVG 包装方案：
                 const logoBase64 = resizedLogo.toString('base64');
                 // 根据 gravity 计算 x, y
                 let x = '50%', y = '50%';
                 let anchor = 'middle', baseline = 'middle';
                 
                 // 简单的 SVG 覆盖全图
                 const svgWrapper = `
                    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                      <image
                        href="data:image/png;base64,${logoBase64}"
                        width="${logoW}"
                        height="${logoH}"
                        opacity="${watermarkConfig.opacity}"
                        x="${gravity.includes('west') ? '5%' : gravity.includes('east') ? '95%' : '50%'}"
                        y="${gravity.includes('north') ? '5%' : gravity.includes('south') ? '95%' : '50%'}"
                        transform="translate(${gravity.includes('west') ? 0 : gravity.includes('east') ? -logoW : -logoW/2}, ${gravity.includes('north') ? 0 : gravity.includes('south') ? -logoH : -logoH/2})"
                      />
                    </svg>
                 `;
                 watermarkBuffer = Buffer.from(svgWrapper);
                 gravity = 'center'; // SVG 已经定位好了
              }
            }
          } catch (e) {
            console.error('Failed to load watermark logo:', e);
          }
        }

        if (watermarkBuffer) {
          previewPipeline = previewPipeline.composite([
            {
              input: watermarkBuffer,
              gravity: gravity as any,
            },
          ]);
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
