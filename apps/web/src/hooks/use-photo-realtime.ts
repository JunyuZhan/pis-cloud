'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Photo } from '@/types/database'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PhotoChangePayload = RealtimePostgresChangesPayload<Photo>

interface UsePhotoRealtimeOptions {
  albumId: string
  enabled?: boolean
  onInsert?: (photo: Photo) => void
  onUpdate?: (photo: Photo) => void
  onDelete?: (photoId: string) => void
}

/**
 * Supabase Realtime Hook - 监听照片变更
 * 
 * 使用方法:
 * ```tsx
 * usePhotoRealtime({
 *   albumId: album.id,
 *   enabled: true,
 *   onInsert: (photo) => {
 *     // 新照片插入，添加到列表
 *     setPhotos(prev => [photo, ...prev])
 *   },
 *   onUpdate: (photo) => {
 *     // 照片更新 (如 status 变更)
 *     setPhotos(prev => prev.map(p => p.id === photo.id ? photo : p))
 *   },
 *   onDelete: (photoId) => {
 *     // 照片删除，从列表移除
 *     setPhotos(prev => prev.filter(p => p.id !== photoId))
 *   }
 * })
 * ```
 */
export function usePhotoRealtime({
  albumId,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UsePhotoRealtimeOptions) {
  const supabase = createClient()
  
  // 使用 ref 存储回调，避免重复订阅
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete })
  callbacksRef.current = { onInsert, onUpdate, onDelete }

  const handleChanges = useCallback((payload: PhotoChangePayload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        if (newRecord && newRecord.album_id === albumId) {
          // 仅处理 completed 状态的照片
          if (newRecord.status === 'completed') {
            callbacksRef.current.onInsert?.(newRecord as Photo)
          }
        }
        break

      case 'UPDATE':
        if (newRecord && newRecord.album_id === albumId) {
          // 照片处理完成时触发插入
          if (
            oldRecord?.status !== 'completed' &&
            newRecord.status === 'completed'
          ) {
            callbacksRef.current.onInsert?.(newRecord as Photo)
          } else if (newRecord.status === 'completed') {
            callbacksRef.current.onUpdate?.(newRecord as Photo)
          }
        }
        break

      case 'DELETE':
        if (oldRecord && oldRecord.album_id === albumId) {
          callbacksRef.current.onDelete?.(oldRecord.id as string)
        }
        break
    }
  }, [albumId])

  useEffect(() => {
    if (!enabled || !albumId) return

    // 订阅照片表的变更
    const channel = supabase
      .channel(`photos:album:${albumId}`)
      .on<Photo>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `album_id=eq.${albumId}`,
        },
        handleChanges
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔔 Realtime subscribed: album ${albumId}`)
        }
      })

    return () => {
      console.log(`🔕 Realtime unsubscribed: album ${albumId}`)
      supabase.removeChannel(channel)
    }
  }, [supabase, albumId, enabled, handleChanges])
}

/**
 * 管理员端使用 - 监听所有状态变更
 */
export function usePhotoRealtimeAdmin({
  albumId,
  enabled = true,
  onStatusChange,
}: {
  albumId: string
  enabled?: boolean
  onStatusChange?: (photoId: string, status: Photo['status']) => void
}) {
  const supabase = createClient()
  const callbackRef = useRef(onStatusChange)
  callbackRef.current = onStatusChange

  useEffect(() => {
    if (!enabled || !albumId) return

    const channel = supabase
      .channel(`admin:photos:${albumId}`)
      .on<Photo>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photos',
          filter: `album_id=eq.${albumId}`,
        },
        (payload) => {
          const newPhoto = payload.new as Photo
          const oldPhoto = payload.old as Partial<Photo>
          
          if (newPhoto.status !== oldPhoto.status) {
            callbackRef.current?.(newPhoto.id, newPhoto.status)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, albumId, enabled])
}
