import { z } from 'zod'
import { AppError } from '@/server/errors'
import { requireUser } from '@/server/guard'
import { getAccessToken } from '@/server/google/tokens'
import { getFileForUser } from '@/server/files'

export const runtime = 'nodejs'

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params
    const fileId = z.string().uuid().parse(id)

    const url = new URL(req.url)
    const sizeParam = url.searchParams.get('size') || 's'
    const sizeMap: Record<string, string> = { 's': '220', 'm': '600', 'l': '1600' }
    const mappedSize = sizeMap[sizeParam] || '220'

    const user = await requireUser()
    const file = await getFileForUser(user, fileId)

    const ifNoneMatch = req.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === `"${file.version}"`) {
      return new Response(null, { status: 304 })
    }

    const token = await getAccessToken(file.driveAccountId)

    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?fields=thumbnailLink,version&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: req.signal,
      }
    )

    if (!metaRes.ok) {
      if (metaRes.status === 404) return errorResponse('NOT_FOUND', 'File not found in Drive', 404)
      return errorResponse('UPSTREAM_ERROR', 'Google Drive error fetching metadata', 502)
    }

    const meta = await metaRes.json()
    if (!meta.thumbnailLink) {
      return errorResponse('NOT_FOUND', 'No thumbnail available', 404)
    }

    const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, `=s${mappedSize}`)

    const thumbRes = await fetch(thumbUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: req.signal,
    })

    if (!thumbRes.ok) {
      return errorResponse('UPSTREAM_ERROR', 'Google Drive error fetching thumbnail bytes', 502)
    }

    const headers = new Headers()
    headers.set('content-type', thumbRes.headers.get('content-type') || 'image/jpeg')
    headers.set('cache-control', 'private, max-age=86400')
    if (meta.version) {
      headers.set('etag', `"${meta.version}"`)
    }

    return new Response(thumbRes.body, { status: 200, headers })

  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.status)
    if (err instanceof z.ZodError) return errorResponse('VALIDATION', 'Invalid file id', 400)
    if (err instanceof DOMException && err.name === 'AbortError') return new Response(null, { status: 499 })
    throw err
  }
}
