/**
 * PIS Photo Processor - Image Processing with Sharp
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import sharp from 'sharp';
import { encode } from 'blurhash';
import exifReader from 'exif-reader';
import { STYLE_PRESETS, getPresetById, type StylePresetConfig } from './lib/style-presets.js';

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
  margin?: number; // 边距（百分比，0-20，默认5）
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

  /**
   * 验证 Logo URL 是否安全（防止 SSRF 攻击）
   */
  private isValidLogoUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const allowedProtocols = ['https:', 'http:'];
      
      // 从环境变量获取允许的域名白名单
      const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || process.env.MEDIA_URL;
      const allowedHosts = [
        process.env.MEDIA_DOMAIN,
        mediaUrl ? new URL(mediaUrl).hostname : null,
      ].filter(Boolean) as string[];
      
      // 检查协议
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return false;
      }
      
      // 检查是否为内网地址（SSRF 防护）
      const hostname = urlObj.hostname.toLowerCase();
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
      const isPrivateIP = 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        (hostname.startsWith('172.') && 
         parseInt(hostname.split('.')[1] || '0') >= 16 && 
         parseInt(hostname.split('.')[1] || '0') <= 31) ||
        hostname.endsWith('.local');
      
      if (isLocalhost || isPrivateIP) {
        console.warn(`[Security] Blocked internal URL: ${url}`);
        return false;
      }
      
      // 如果配置了白名单，只允许白名单中的域名
      if (allowedHosts.length > 0) {
        const isAllowed = allowedHosts.some(allowed => {
          const allowedHostname = allowed.toLowerCase();
          return hostname === allowedHostname || hostname.endsWith('.' + allowedHostname);
        });
        if (!isAllowed) {
          console.warn(`[Security] URL not in whitelist: ${url}`);
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 应用风格预设
   * @param image Sharp 图像对象
   * @param presetId 预设 ID（如 "japanese-fresh"）或 null（无风格）
   * @returns 处理后的 Sharp 图像对象
   */
  private applyStylePreset(
    image: sharp.Sharp,
    presetId: string | null | undefined
  ): sharp.Sharp {
    // 如果未选择预设或选择"无风格"，直接返回原图
    if (!presetId || presetId === 'none') {
      return image;
    }

    // 获取预设配置
    const preset = getPresetById(presetId);
    if (!preset) {
      console.warn(`[StylePreset] Unknown preset: ${presetId}, skipping`);
      return image;
    }

    const config = preset.config;
    let processedImage = image.clone();

    // 应用 modulate（亮度、饱和度、色相）
    if (config.brightness !== undefined || 
        config.saturation !== undefined || 
        config.hue !== undefined) {
      processedImage = processedImage.modulate({
        brightness: config.brightness ?? 1.0,
        saturation: config.saturation ?? 1.0,
        hue: config.hue ?? 0,
      });
    }

    // 应用对比度
    // 注意：Sharp 的 TypeScript 类型定义可能不完整，使用类型断言
    if (config.contrast !== undefined && config.contrast !== 0) {
      processedImage = (processedImage as any).contrast(config.contrast);
    }

    // 应用伽马校正
    if (config.gamma !== undefined && config.gamma !== 1.0) {
      processedImage = processedImage.gamma(config.gamma);
    }

    // 应用色调叠加（用于色温模拟）
    if (config.tint) {
      processedImage = processedImage.tint(config.tint);
    }

    return processedImage;
  }

  async process(
    watermarkConfig?: WatermarkConfig, 
    manualRotation?: number | null,
    stylePresetId?: string | null
  ): Promise<ProcessedResult> {
    // 先获取原始 metadata（用于提取 EXIF）
    const originalMetadata = await this.image.metadata();
    
    // 1. 提取 EXIF（剥离敏感信息）
    let exif = {};
    if (originalMetadata.exif) {
      try {
        const rawExif = exifReader(originalMetadata.exif);
        // 剥离 GPS 地理位置信息，防止隐私泄露
        exif = this.sanitizeExif(rawExif);
      } catch (e) {
        console.warn('Failed to parse EXIF:', e);
      }
    }

    // 应用旋转：如果有手动旋转角度，使用手动角度；否则使用 EXIF orientation 自动旋转
    let rotatedImage: sharp.Sharp;
    if (manualRotation !== null && manualRotation !== undefined) {
      // 手动旋转：先应用 EXIF orientation，再应用手动旋转
      rotatedImage = this.image.clone().rotate().rotate(manualRotation);
    } else {
      // 自动旋转：只根据 EXIF orientation
      rotatedImage = this.image.clone().rotate();
    }
    
    // 应用风格预设（在旋转之后，水印之前）
    rotatedImage = this.applyStylePreset(rotatedImage, stylePresetId);
    
    const metadata = await rotatedImage.metadata();

    // 2. 并行生成：BlurHash + 缩略图（优化性能）
    // 优化：BlurHash 使用已旋转的图像，避免重复旋转
    // 支持通过环境变量配置缩略图标准，默认 400px（向后兼容）
    // 重要：每个并行任务都使用独立的 clone()，确保完全隔离，避免图片数据混乱
    // 防御性措施：在并行处理前创建完全独立的 Sharp 实例，防止并发时的数据共享问题
    const thumbSize = parseInt(process.env.THUMB_MAX_SIZE || '400', 10);
    
    // 为每个并行任务创建完全独立的 Sharp 实例
    // 这确保了即使在 Sharp 内部实现有并发问题的情况下，也能保证数据隔离
    const thumbImage = rotatedImage.clone();
    const blurHashImage = rotatedImage.clone();
    
    const [blurHash, thumbBuffer] = await Promise.all([
      // 生成 BlurHash（基于已旋转的图片，避免重复旋转）
      // 使用独立的 Sharp 实例确保数据隔离
      this.generateBlurHashFromRotated(blurHashImage),
      // 生成缩略图 - 自动根据 EXIF orientation 旋转
      // 使用独立的 Sharp 实例确保数据隔离
      thumbImage
        .resize(thumbSize, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    ]);

    // 4. 生成预览图 - 自动根据 EXIF orientation 旋转
    // 优化：直接从 metadata 获取尺寸，避免重复编码/解码
    const { width: originalWidth, height: originalHeight } = metadata;
    
    // 计算预览图尺寸（保持宽高比）
    // 支持通过环境变量配置预览图标准，默认 1920px（向后兼容）
    const maxPreviewSize = parseInt(process.env.PREVIEW_MAX_SIZE || '1920', 10);
    let previewWidth = originalWidth || maxPreviewSize;
    let previewHeight = originalHeight || maxPreviewSize;
    
    if (previewWidth > maxPreviewSize || previewHeight > maxPreviewSize) {
      const ratio = Math.min(maxPreviewSize / previewWidth, maxPreviewSize / previewHeight);
      previewWidth = Math.floor(previewWidth * ratio);
      previewHeight = Math.floor(previewHeight * ratio);
    }
    
    // 优化：复用 rotatedImage，减少 clone 操作
    // 注意：previewPipeline 会在后面被修改（添加水印），所以需要 clone
    let previewPipeline = rotatedImage
      .clone()
      .resize(maxPreviewSize, null, { withoutEnlargement: true });

    // 添加水印
    if (watermarkConfig?.enabled) {
      const watermarkStartTime = Date.now();
      const width = previewWidth;
      const height = previewHeight;
      
      // 边界检查：确保图片尺寸有效
      if (!width || !height || width <= 0 || height <= 0) {
        console.warn(`[Watermark] Invalid image dimensions: ${width}x${height}, skipping watermark`);
      } else {
        console.log(`[Watermark] Processing watermarks for image ${width}x${height}`);
        
        const composites: Array<{ input: Buffer; gravity: string }> = [];

        // 支持多个水印（新格式）
        if (watermarkConfig.watermarks && Array.isArray(watermarkConfig.watermarks)) {
          const enabledCount = watermarkConfig.watermarks.filter(w => w.enabled !== false).length;
          console.log(`[Watermark] Found ${watermarkConfig.watermarks.length} watermarks, ${enabledCount} enabled`);
          
          // 并行处理多个水印（性能优化）
          const enabledWatermarks = watermarkConfig.watermarks.filter(w => w.enabled !== false);
          const watermarkPromises = enabledWatermarks.map(watermark =>
            this.createWatermarkBuffer(watermark, width, height)
          );
          
          // 并行创建所有水印 buffer
          const watermarkBuffers = await Promise.all(watermarkPromises);
          
          // 构建 composites 数组
          for (let i = 0; i < enabledWatermarks.length; i++) {
            const watermarkBuffer = watermarkBuffers[i];
            if (watermarkBuffer) {
              const gravity = this.positionToGravity(enabledWatermarks[i].position);
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
        
        const watermarkDuration = Date.now() - watermarkStartTime;
        console.log(`[Watermark] Processing completed in ${watermarkDuration}ms`);
        
        if (watermarkDuration > 5000) {
          console.warn(`[Watermark] Slow watermark processing: ${watermarkDuration}ms`);
        }
      }
    }

    const previewBuffer = await previewPipeline
      .jpeg({ quality: 85 })
      .toBuffer();
    
    return {
      metadata, // 已经是旋转后的 metadata，包含正确的宽高
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
      // 优化字体大小计算：使用面积而非最小边，避免超宽/超高图片字体过小
      const baseSize = Math.sqrt(imageWidth * imageHeight);
      const fontSize = watermark.size || Math.max(12, Math.min(72, Math.floor(baseSize * 0.01)));
      const { x, y, anchor, baseline } = this.getTextPosition(watermark.position, imageWidth, imageHeight, watermark.margin);
      
      const svgText = `
        <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .watermark { fill: rgba(255, 255, 255, ${watermark.opacity}); font-size: ${fontSize}px; font-family: "Noto Sans CJK SC", "Noto Sans CJK", "Noto Sans", Arial, Helvetica, "Microsoft YaHei", "SimHei", "SimSun", "Arial Unicode MS", sans-serif; font-weight: bold; }
          </style>
          <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" class="watermark">${this.escapeXml(watermark.text)}</text>
        </svg>
      `;
      return Buffer.from(svgText);
    } else if (watermark.type === 'logo' && watermark.logoUrl) {
      // 安全验证：检查 URL 是否安全
      if (!this.isValidLogoUrl(watermark.logoUrl)) {
        console.error(`[Watermark] Invalid or unsafe logo URL: ${watermark.logoUrl}`);
        return null;
      }
      
      try {
        // 设置超时和大小限制（防止 SSRF 和内存溢出）
        const controller = new AbortController();
        const timeoutMs = 10000; // 10秒超时
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const maxSize = 10 * 1024 * 1024; // 10MB 限制

        try {
          const response = await fetch(watermark.logoUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'PIS-Watermark/1.0',
            },
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
          }
          
          // 检查 Content-Length
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > maxSize) {
            throw new Error(`Logo file too large: ${contentLength} bytes (max: ${maxSize} bytes)`);
          }
          
          const logoBuffer = await response.arrayBuffer();
          
          // 再次检查实际大小
          if (logoBuffer.byteLength > maxSize) {
            throw new Error(`Logo file too large: ${logoBuffer.byteLength} bytes (max: ${maxSize} bytes)`);
          }
          
          const logoSize = watermark.size || Math.floor(Math.min(imageWidth, imageHeight) * 0.15);

          // 优化：一次性获取 buffer 和 metadata，避免重复创建 Sharp 实例
          const resizedLogoResult = await sharp(Buffer.from(logoBuffer))
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer({ resolveWithObject: true });

          const logoW = resizedLogoResult.info.width;
          const logoH = resizedLogoResult.info.height;
          
          if (logoW && logoH) {
            const { x, y } = this.getImagePosition(watermark.position, imageWidth, imageHeight, logoW, logoH, watermark.margin);
            const logoBase64 = resizedLogoResult.data.toString('base64');

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
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error(`[Watermark] Logo download timeout after ${timeoutMs}ms: ${watermark.logoUrl}`);
          } else {
            throw fetchError;
          }
        }
      } catch (e: any) {
        console.error(`[Watermark] Failed to load logo from ${watermark.logoUrl}:`, e.message || e);
        // 不中断整个处理流程，只跳过该水印
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
    height: number,
    customMargin?: number
  ): { x: string; y: string; anchor: string; baseline: string } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05; // 自定义边距或默认5%
    const margin = Math.min(width, height) * marginPercent;

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
   * 获取图片水印的位置坐标（带边界检查）
   */
  private getImagePosition(
    position: string,
    imageWidth: number,
    imageHeight: number,
    logoWidth: number,
    logoHeight: number,
    customMargin?: number
  ): { x: number; y: number } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05; // 自定义边距或默认5%
    const margin = Math.min(imageWidth, imageHeight) * marginPercent;
    
    // 确保 logo 不会超出图片边界
    const maxX = Math.max(0, imageWidth - logoWidth);
    const maxY = Math.max(0, imageHeight - logoHeight);

    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: Math.min(margin, maxX), y: Math.min(margin, maxY) },
      'top-center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.min(margin, maxY) },
      'top-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.min(margin, maxY) },
      'center-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'center-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'bottom-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
      'bottom-center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
      'bottom-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
    };

    const pos = positions[position] || positions['center'];
    
    // 最终边界检查，确保坐标在有效范围内
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    };
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

  /**
   * 从已旋转的图像生成 BlurHash（性能优化：避免重复旋转）
   */
  private async generateBlurHashFromRotated(rotatedImage: sharp.Sharp): Promise<string> {
    const { data, info } = await rotatedImage
      .clone()
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  }

  /**
   * 生成 BlurHash（旧方法，保留用于兼容）
   * @deprecated 使用 generateBlurHashFromRotated 代替，性能更好
   */
  private async generateBlurHash(manualRotation?: number | null): Promise<string> {
    let image = this.image.clone();
    
    // 应用旋转：如果有手动旋转角度，使用手动角度；否则使用 EXIF orientation 自动旋转
    if (manualRotation !== null && manualRotation !== undefined) {
      image = image.rotate().rotate(manualRotation); // 先应用 EXIF，再应用手动旋转
    } else {
      image = image.rotate(); // 只应用 EXIF orientation
    }
    
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  }
}
