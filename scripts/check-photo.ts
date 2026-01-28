#!/usr/bin/env tsx
/**
 * 检查照片信息脚本
 * 用法: tsx scripts/check-photo.ts <filename>
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

// 加载环境变量
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  config({ path: envPath })
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必要的环境变量: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPhoto(filename: string) {
  console.log(`\n🔍 正在查找照片: ${filename}\n`)

  // 查询照片信息
  const { data: photos, error } = await supabase
    .from('photos')
    .select(`
      id,
      album_id,
      filename,
      file_size,
      width,
      height,
      mime_type,
      status,
      original_key,
      preview_key,
      thumb_key,
      rotation,
      is_selected,
      captured_at,
      created_at,
      updated_at,
      deleted_at,
      albums!inner (
        id,
        title,
        slug
      )
    `)
    .ilike('filename', `%${filename}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查询错误:', error.message)
    process.exit(1)
  }

  if (!photos || photos.length === 0) {
    console.log('❌ 未找到匹配的照片')
    process.exit(0)
  }

  console.log(`✅ 找到 ${photos.length} 张匹配的照片:\n`)

  photos.forEach((photo, index) => {
    const album = photo.albums as any
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📸 照片 #${index + 1}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`ID:              ${photo.id}`)
    console.log(`文件名:          ${photo.filename}`)
    console.log(`相册:            ${album.title} (${album.slug})`)
    console.log(`相册ID:          ${photo.album_id}`)
    console.log(`状态:            ${photo.status}`)
    console.log(`文件大小:        ${photo.file_size ? `${(photo.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`)
    console.log(`尺寸:            ${photo.width} × ${photo.height}`)
    console.log(`MIME类型:        ${photo.mime_type || 'N/A'}`)
    console.log(`旋转角度:        ${photo.rotation || '自动'}`)
    console.log(`已选中:          ${photo.is_selected ? '是' : '否'}`)
    console.log(`拍摄时间:        ${photo.captured_at || 'N/A'}`)
    console.log(`创建时间:        ${photo.created_at}`)
    console.log(`更新时间:        ${photo.updated_at}`)
    console.log(`已删除:          ${photo.deleted_at ? `是 (${photo.deleted_at})` : '否'}`)
    console.log(`\n存储路径:`)
    console.log(`  原图:          ${photo.original_key || 'N/A'}`)
    console.log(`  预览图:        ${photo.preview_key || 'N/A'}`)
    console.log(`  缩略图:        ${photo.thumb_key || 'N/A'}`)
    console.log(`\n`)
  })

  // 检查存储文件是否存在
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || process.env.MEDIA_URL
  if (mediaUrl) {
    console.log(`\n📁 存储URL前缀: ${mediaUrl}`)
    photos.forEach((photo, index) => {
      if (photo.thumb_key) {
        console.log(`\n照片 #${index + 1} 访问链接:`)
        console.log(`  缩略图: ${mediaUrl}/${photo.thumb_key}`)
        if (photo.preview_key) {
          console.log(`  预览图: ${mediaUrl}/${photo.preview_key}`)
        }
        if (photo.original_key) {
          console.log(`  原图:   ${mediaUrl}/${photo.original_key}`)
        }
      }
    })
  }
}

// 获取命令行参数
const filename = process.argv[2]

if (!filename) {
  console.error('❌ 请提供照片文件名')
  console.log('用法: tsx scripts/check-photo.ts <filename>')
  console.log('示例: tsx scripts/check-photo.ts DSC06687')
  process.exit(1)
}

checkPhoto(filename)
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
