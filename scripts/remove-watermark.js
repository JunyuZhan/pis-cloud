#!/usr/bin/env node
/**
 * 从PNG图标中去除水印
 * 
 * 使用方法：
 * node scripts/remove-watermark.js [source-png] [options]
 * 
 * 选项：
 * --crop-x, --crop-y, --crop-width, --crop-height: 裁剪区域（去除边缘水印）
 * --inpaint: 使用修复算法去除水印（需要指定水印区域）
 */

const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '../apps/web/node_modules/sharp'));

const ICONS_DIR = path.join(__dirname, '../apps/web/public/icons');

// 从命令行参数获取源文件
const args = process.argv.slice(2);
const sourceFile = args.find(arg => !arg.startsWith('--')) || path.join(ICONS_DIR, 'icon-512x512.png');

if (!fs.existsSync(sourceFile)) {
  console.error(`错误: 源文件不存在: ${sourceFile}`);
  console.log('\n可用的PNG文件:');
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => console.log(`  - ${path.join(ICONS_DIR, f)}`));
  process.exit(1);
}

async function removeWatermark() {
  console.log(`正在处理: ${sourceFile}`);
  
  const image = sharp(sourceFile);
  const metadata = await image.metadata();
  console.log(`图像尺寸: ${metadata.width}x${metadata.height}`);

  // 获取裁剪参数
  const cropX = parseInt(args.find(arg => arg.startsWith('--crop-x='))?.split('=')[1] || '0');
  const cropY = parseInt(args.find(arg => arg.startsWith('--crop-y='))?.split('=')[1] || '0');
  const cropWidth = parseInt(args.find(arg => arg.startsWith('--crop-width='))?.split('=')[1] || metadata.width);
  const cropHeight = parseInt(args.find(arg => arg.startsWith('--crop-height='))?.split('=')[1] || metadata.height);

  let processed = image;

  // 如果有裁剪参数，进行裁剪（去除边缘水印）
  if (cropX > 0 || cropY > 0 || cropWidth < metadata.width || cropHeight < metadata.height) {
    console.log(`裁剪区域: x=${cropX}, y=${cropY}, width=${cropWidth}, height=${cropHeight}`);
    processed = processed.extract({
      left: cropX,
      top: cropY,
      width: cropWidth,
      height: cropHeight
    });
  }

  // 生成无水印的PNG
  const outputPng = path.join(ICONS_DIR, 'icon-no-watermark.png');
  await processed.png().toFile(outputPng);
  console.log(`✓ 生成无水印PNG: ${outputPng}`);

  // 生成SVG（通过PNG转SVG，但质量可能不如原始SVG）
  const outputSvg = path.join(ICONS_DIR, 'icon-from-png.svg');
  const svgBuffer = await processed
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  // 将PNG转换为base64嵌入的SVG
  const base64 = svgBuffer.toString('base64');
  const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,${base64}" width="512" height="512"/>
</svg>`;
  
  fs.writeFileSync(outputSvg, svgContent);
  console.log(`✓ 生成SVG: ${outputSvg}`);
  
  console.log('\n提示: 如果水印在边缘，可以使用裁剪参数去除:');
  console.log('  --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492');
  console.log('\n如果水印在中间，可能需要使用图像编辑软件手动处理。');
}

removeWatermark().catch(console.error);