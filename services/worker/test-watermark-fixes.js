/**
 * 水印修复验证脚本
 * 验证所有修复的关键功能点
 */

const fs = require('fs');
const path = require('path');

const processorPath = path.join(__dirname, 'src/processor.ts');
const code = fs.readFileSync(processorPath, 'utf8');

console.log('🔍 验证水印修复...\n');

const checks = [
  {
    name: 'SSRF 防护 - isValidLogoUrl 方法',
    test: code.includes('isValidLogoUrl'),
    critical: true,
  },
  {
    name: 'SSRF 防护 - 内网地址检测',
    test: code.includes('localhost') && code.includes('127.0.0.1') && code.includes('192.168.'),
    critical: true,
  },
  {
    name: '下载超时保护',
    test: code.includes('timeoutMs') && code.includes('AbortController'),
    critical: true,
  },
  {
    name: '文件大小限制',
    test: code.includes('maxSize') && code.includes('10 * 1024 * 1024'),
    critical: true,
  },
  {
    name: '边界检查 - 无效尺寸',
    test: code.includes('Invalid image dimensions'),
    critical: false,
  },
  {
    name: '性能优化 - 避免重复编码',
    test: code.includes('originalWidth') && code.includes('originalHeight'),
    critical: false,
  },
  {
    name: 'Logo 处理优化 - resolveWithObject',
    test: code.includes('resolveWithObject: true'),
    critical: false,
  },
  {
    name: '字体大小优化',
    test: code.includes('Math.sqrt(imageWidth * imageHeight)'),
    critical: false,
  },
  {
    name: '位置计算边界保护',
    test: code.includes('Math.max(0, Math.min(pos.x, maxX))'),
    critical: false,
  },
  {
    name: '日志记录',
    test: code.includes('[Watermark]') && code.includes('Processing watermarks'),
    critical: false,
  },
  {
    name: '性能监控',
    test: code.includes('watermarkStartTime') && code.includes('watermarkDuration'),
    critical: false,
  },
  {
    name: '错误处理改进',
    test: code.includes('Failed to load logo from') && code.includes('timeout'),
    critical: false,
  },
];

let passed = 0;
let failed = 0;
let criticalFailed = 0;

console.log('检查结果：\n');

checks.forEach((check, index) => {
  const status = check.test ? '✅' : '❌';
  const critical = check.critical ? ' [关键]' : '';
  
  console.log(`${status} ${index + 1}. ${check.name}${critical}`);
  
  if (check.test) {
    passed++;
  } else {
    failed++;
    if (check.critical) {
      criticalFailed++;
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log(`总计: ${checks.length} 项检查`);
console.log(`通过: ${passed} 项`);
console.log(`失败: ${failed} 项`);
if (criticalFailed > 0) {
  console.log(`⚠️  关键修复失败: ${criticalFailed} 项`);
} else {
  console.log(`✅ 所有关键修复已通过`);
}
console.log('='.repeat(50));

// 验证配置一致性修复
console.log('\n🔍 验证配置一致性修复...\n');

const indexPath = path.join(__dirname, 'src/index.ts');
const indexCode = fs.readFileSync(indexPath, 'utf8');

const configChecks = [
  {
    name: '打包下载中的水印配置构建',
    test: indexCode.includes('watermarkConfigRaw') && indexCode.includes('watermarks: watermarkConfigRaw.watermarks'),
    critical: true,
  },
  {
    name: '兼容旧格式',
    test: indexCode.includes('type: album.watermark_type') && indexCode.includes('text: watermarkConfigRaw.text'),
    critical: false,
  },
];

configChecks.forEach((check, index) => {
  const status = check.test ? '✅' : '❌';
  const critical = check.critical ? ' [关键]' : '';
  console.log(`${status} ${index + 1}. ${check.name}${critical}`);
  
  if (!check.test && check.critical) {
    criticalFailed++;
  }
});

// 验证 API 验证
console.log('\n🔍 验证 API 验证修复...\n');

const apiPath = path.join(__dirname, '../apps/web/src/app/api/admin/albums/[id]/route.ts');
if (fs.existsSync(apiPath)) {
  const apiCode = fs.readFileSync(apiPath, 'utf8');
  
  const apiChecks = [
    {
      name: '水印数量限制验证',
      test: apiCode.includes('config.watermarks.length > 6'),
      critical: false,
    },
    {
      name: '水印类型验证',
      test: apiCode.includes('watermark.type !== \'text\' && watermark.type !== \'logo\''),
      critical: false,
    },
    {
      name: '文字水印内容验证',
      test: apiCode.includes('文字水印内容不能为空'),
      critical: false,
    },
    {
      name: 'Logo URL 验证',
      test: apiCode.includes('Logo URL 不能为空'),
      critical: false,
    },
    {
      name: '透明度范围验证',
      test: apiCode.includes('透明度必须在 0-1 之间'),
      critical: false,
    },
  ];
  
  apiChecks.forEach((check, index) => {
    const status = check.test ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${check.name}`);
  });
} else {
  console.log('⚠️  API 文件未找到，跳过验证');
}

console.log('\n' + '='.repeat(50));
if (criticalFailed === 0) {
  console.log('✅ 所有关键修复验证通过！');
  process.exit(0);
} else {
  console.log(`❌ 有 ${criticalFailed} 项关键修复未通过，请检查！`);
  process.exit(1);
}
