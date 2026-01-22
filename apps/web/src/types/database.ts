/**
 * Supabase 数据库类型定义
 * TODO: BE (gpt5.2) - 创建 Supabase 项目后运行 `supabase gen types` 生成实际类型
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      albums: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          cover_photo_id: string | null
          is_public: boolean
          // 访问控制
          password: string | null
          expires_at: string | null
          // 布局设置
          layout: 'masonry' | 'grid' | 'carousel'
          sort_rule: 'capture_desc' | 'capture_asc' | 'manual'
          // 功能开关
          allow_download: boolean
          allow_batch_download: boolean
          show_exif: boolean
          // 水印设置
          watermark_enabled: boolean
          watermark_type: 'text' | 'logo' | null
          watermark_config: Json
          // 统计
          photo_count: number
          selected_count: number
          view_count: number
          // 时间戳
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          slug?: string
          title: string
          description?: string | null
          cover_photo_id?: string | null
          is_public?: boolean
          password?: string | null
          expires_at?: string | null
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          photo_count?: number
          selected_count?: number
          view_count?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string | null
          cover_photo_id?: string | null
          is_public?: boolean
          password?: string | null
          expires_at?: string | null
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          photo_count?: number
          selected_count?: number
          view_count?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      photos: {
        Row: {
          id: string
          album_id: string
          original_key: string
          preview_key: string | null
          thumb_key: string | null
          filename: string
          file_size: number | null
          width: number | null
          height: number | null
          mime_type: string | null
          blur_data: string | null
          exif: Json
          captured_at: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          is_selected: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          album_id: string
          original_key: string
          preview_key?: string | null
          thumb_key?: string | null
          filename: string
          file_size?: number | null
          width?: number | null
          height?: number | null
          mime_type?: string | null
          blur_data?: string | null
          exif?: Json
          captured_at?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          is_selected?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          album_id?: string
          original_key?: string
          preview_key?: string | null
          thumb_key?: string | null
          filename?: string
          file_size?: number | null
          width?: number | null
          height?: number | null
          mime_type?: string | null
          blur_data?: string | null
          exif?: Json
          captured_at?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          is_selected?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// 便捷类型别名
export type Album = Database['public']['Tables']['albums']['Row']
export type AlbumInsert = Database['public']['Tables']['albums']['Insert']
export type AlbumUpdate = Database['public']['Tables']['albums']['Update']

export type Photo = Database['public']['Tables']['photos']['Row']
export type PhotoInsert = Database['public']['Tables']['photos']['Insert']
export type PhotoUpdate = Database['public']['Tables']['photos']['Update']
