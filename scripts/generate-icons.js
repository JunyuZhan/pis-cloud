#!/usr/bin/env node
/**
 * PWA 图标生成脚本
 * 将 SVG 图标转换为各种尺寸的 PNG
 * 
 * 使用方法：
 * 1. 确保已在 apps/web 中安装 sharp
 * 2. 运行脚本：node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// 从 apps/web 的 node_modules 加载 sharp
const sharp = require(path.join(__dirname, '../apps/web/node_modules/sharp'));

const ICONS_DIR = path.join(__dirname, '../apps/web/public/icons');
const SOURCE_PNG = path.join(ICONS_DIR, '截屏2026-01-23 00.45.08.png');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// 需要生成的尺寸
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('开始生成 PWA 图标...');

  // 确保图标目录存在
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // 优先使用 PNG 源文件，否则使用 SVG
  let sourceBuffer;
  if (fs.existsSync(SOURCE_PNG)) {
    console.log('使用 PNG 源文件...');
    sourceBuffer = fs.readFileSync(SOURCE_PNG);
  } else {
    console.log('使用 SVG 源文件...');
    sourceBuffer = fs.readFileSync(SVG_PATH);
  }

  // 生成各尺寸的 PNG
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ 生成 ${size}x${size} 图标`);
  }

  // 生成 favicon
  await sharp(sourceBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(__dirname, '../apps/web/public/favicon.ico'));
  console.log('✓ 生成 favicon.ico');

  // 生成占位图
  await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 30, g: 30, b: 30, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(ICONS_DIR, 'placeholder.png'));
  console.log('✓ 生成占位图');

  console.log('\n✅ 所有图标生成完成！');
}

generateIcons().catch(console.error);
