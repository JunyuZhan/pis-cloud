import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Check if file is duplicate
 * POST /api/admin/albums/[id]/check-duplicate
 * 
 * Request body:
 * {
 *   filename: string,
 *   fileSize: number,
 *   fileHash?: string  // Optional, if provided uses hash-based detection (more accurate)
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    let albumId: string
    try {
      const paramsResult = await params
      albumId = paramsResult.id
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Invalid request parameters' } },
        { status: 400 }
      )
    }

    const response = new NextResponse()
    const supabase = createClientFromRequest(request, response)

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Please login first' } },
        { 
          status: 401,
          headers: response.headers,
        }
      )
    }

    // Verify album exists
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: { code: 'ALBUM_NOT_FOUND', message: 'Album not found' } },
        { 
          status: 404,
          headers: response.headers,
        }
      )
    }

    // Parse request body
    interface CheckDuplicateRequestBody {
      filename: string
      fileSize: number
      fileHash?: string
    }

    let body: CheckDuplicateRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid request body format' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    const { filename, fileSize, fileHash } = body

    if (!filename || fileSize === undefined) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    const adminClient = createAdminClient()

    // Check for duplicates: prefer file hash if provided, otherwise use filename + file size
    let duplicatePhoto = null

    if (fileHash) {
      // Use hash-based detection (most accurate)
      // Note: This query will fail if the hash field doesn't exist in the database
      // For now, use filename + size detection
      // TODO: Enable this detection after adding hash field to database
      /*
      const { data: hashMatch } = await adminClient
        .from('photos')
        .select('id, filename')
        .eq('album_id', albumId)
        .eq('hash', fileHash)
        .is('deleted_at', null)
        .limit(1)
        .single()
      
      if (hashMatch) {
        duplicatePhoto = hashMatch
      }
      */
    }

    // If not found by hash, use filename + file size detection
    if (!duplicatePhoto) {
      const { data: sizeMatch, error: sizeError } = await adminClient
        .from('photos')
        .select('id, filename, file_size')
        .eq('album_id', albumId)
        .eq('filename', filename)
        .eq('file_size', fileSize)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      // maybeSingle() returns null instead of throwing error when no record found
      if (!sizeError && sizeMatch) {
        duplicatePhoto = sizeMatch
      }
    }

    return NextResponse.json(
      {
        isDuplicate: !!duplicatePhoto,
        duplicatePhoto: duplicatePhoto || null,
      },
      {
        headers: response.headers,
      }
    )
  } catch (error) {
    console.error('[Check Duplicate API] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: errorMessage
        } 
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
