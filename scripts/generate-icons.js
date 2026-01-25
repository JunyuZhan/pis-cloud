#!/usr/bin/env node
/**
 * PWA 图标生成脚本
 * 将 PNG 源图标转换为各种尺寸的 PNG 和 SVG
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
// 优先使用 PNG 源文件，如果没有则使用 SVG
const PNG_SOURCE = path.join(ICONS_DIR, 'Gemini_Generated_Image_e28rwze28rwze28r.png');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// 需要生成的尺寸
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('开始生成 PWA 图标...');

  // 确保图标目录存在
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  let sourceBuffer;
  let sourceType = '';

  // 优先使用 PNG 源文件
  if (fs.existsSync(PNG_SOURCE)) {
    console.log('使用 PNG 源文件:', PNG_SOURCE);
    sourceBuffer = fs.readFileSync(PNG_SOURCE);
    sourceType = 'png';
  } else if (fs.existsSync(SVG_PATH)) {
    console.log('使用 SVG 源文件:', SVG_PATH);
    sourceBuffer = fs.readFileSync(SVG_PATH);
    sourceType = 'svg';
  } else {
    console.error(`错误: 源文件不存在`);
    console.log('请确保以下文件之一存在:');
    console.log(`  - ${PNG_SOURCE}`);
    console.log(`  - ${SVG_PATH}`);
    process.exit(1);
  }

  // 生成各尺寸的 PNG
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ 生成 ${size}x${size} 图标`);
  }

  // 生成 favicon (32x32)
  const faviconPath = path.join(__dirname, '../apps/web/public/favicon.ico');
  await sharp(sourceBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconPath);
  console.log('✓ 生成 favicon.ico');

  // 如果源文件是 PNG，生成一个 SVG 版本用于某些场景
  // 始终更新 SVG 文件以确保使用最新的图标
  if (sourceType === 'png') {
    // 创建一个简单的 SVG，引用 PNG（或者可以转换为 SVG，但这里保持简单）
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <image href="/icons/Gemini_Generated_Image_e28rwze28rwze28r.png" width="1024" height="1024"/>
</svg>`;
    fs.writeFileSync(SVG_PATH, svgContent);
    console.log('✓ 更新 icon.svg (引用 PNG)');
  }

  // 生成占位图（如果不存在）
  const placeholderPath = path.join(ICONS_DIR, 'placeholder.png');
  if (!fs.existsSync(placeholderPath)) {
    await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 }
      }
    })
      .png()
      .toFile(placeholderPath);
    console.log('✓ 生成占位图');
  }

  console.log('\n✅ 所有图标生成完成！');
}

generateIcons().catch(console.error);
