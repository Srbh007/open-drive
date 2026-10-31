import { z } from 'zod'
import { AppError } from '@/server/errors'
import { requireUser } from '@/server/guard'
import { getAccessToken } from '@/server/google/tokens'
import { getFileForUser } from '@/server/files'

export const runtime = 'nodejs'

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'] as const

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

const MIME_MAPPING: Record<string, string> = {
  'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.google-apps.presentation': 'application/pdf',
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params
    const fileId = z.string().uuid().parse(id)
    const user = await requireUser()

    const file = await getFileForUser(user, fileId)
    const token = await getAccessToken(file.driveAccountId)

    const range = req.headers.get('range')
    const isGoogleFile = file.mimeType.startsWith('application/vnd.google-apps.')

    let url: string
    if (isGoogleFile) {
      if (!MIME_MAPPING[file.mimeType]) {
        return errorResponse('UNSUPPORTED_TYPE', 'Google file type not supported for streaming', 400)
      }
      url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}/export?mimeType=${encodeURIComponent(MIME_MAPPING[file.mimeType])}`
    } else {
      url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?alt=media&supportsAllDrives=true`
    }

    const upstream = await fetch(
      url,
      {
        headers: { Authorization: `Bearer ${token}`, ...(range && !isGoogleFile ? { Range: range } : {}) },
        signal: req.signal,
      },
    )

    if (!upstream.ok || !upstream.body) {
      if (upstream.status === 404) return errorResponse('NOT_FOUND', 'File not found in Drive', 404)
      if (upstream.status === 416) return new Response(null, { status: 416, headers: { 'Content-Range': upstream.headers.get('content-range') ?? '' } })
      return errorResponse('UPSTREAM_ERROR', 'Google Drive did not return the file', 502)
    }

    const headers = new Headers()
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    const finalMimeType = isGoogleFile ? MIME_MAPPING[file.mimeType] : file.mimeType
    if (!headers.has('content-type')) headers.set('content-type', finalMimeType)
    headers.set('accept-ranges', 'bytes')
    headers.set('cache-control', 'private, max-age=0')

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.status)
    if (err instanceof z.ZodError) return errorResponse('VALIDATION', 'Invalid file id', 400)
    if (err instanceof DOMException && err.name === 'AbortError') return new Response(null, { status: 499 })
    throw err
  }
}
