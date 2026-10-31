import { AppError } from '@/server/errors'
import { getLinkTarget } from '@/server/links'
import { linkPageLimit } from '@/server/ratelimit'
import { clientIp, requireUnlocked } from '@/server/link-access'
import { getAccessToken } from '@/server/google/tokens'

export const runtime = 'nodejs'

const EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.google-apps.presentation': 'application/pdf',
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

// Public download / preview for a shared link (any kind). Streams with Range support; never buffers.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    if (!(await linkPageLimit.limit(clientIp(req))).success) return errorResponse('RATE_LIMITED', 'Too many requests', 429)

    const { slug } = await ctx.params
    const { link, file } = await getLinkTarget(slug)
    await requireUnlocked(link)
    if (file.isFolder) return errorResponse('VALIDATION', 'Folders cannot be downloaded', 400)

    const exportMime = EXPORT_MIME[file.mimeType]
    if (file.mimeType.startsWith('application/vnd.google-apps.') && !exportMime) {
      return errorResponse('VALIDATION', 'This file type cannot be downloaded', 400)
    }

    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}`
    const url = exportMime ? `${base}/export?mimeType=${encodeURIComponent(exportMime)}` : `${base}?alt=media&supportsAllDrives=true`
    const range = req.headers.get('range')

    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${await getAccessToken(file.driveAccountId)}`, ...(range && !exportMime ? { Range: range } : {}) },
      signal: req.signal,
    })
    if (!upstream.ok || !upstream.body) return errorResponse('UPSTREAM_ERROR', 'The file could not be loaded', 502)

    const headers = new Headers()
    for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('content-type', exportMime ?? file.mimeType)
    headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.title || file.name)}`)
    headers.set('cache-control', 'private, max-age=0')
    headers.set('x-content-type-options', 'nosniff')
    if (!exportMime) headers.set('accept-ranges', 'bytes')

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.status)
    if (err instanceof DOMException && err.name === 'AbortError') return new Response(null, { status: 499 })
    return errorResponse('UPSTREAM_ERROR', 'The file could not be loaded', 502)
  }
}
