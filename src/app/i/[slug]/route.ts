import { AppError } from '@/server/errors'
import { getLinkTarget } from '@/server/links'
import { imageLimit } from '@/server/ratelimit'
import { clientIp } from '@/server/link-access'
import { getAccessToken } from '@/server/google/tokens'

export const runtime = 'nodejs'

// Public, read-only image bytes for product pages. Cached on the CDN; Google is hit about once per image.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!(await imageLimit.limit(clientIp(req))).success) return new Response('Too many requests', { status: 429 })

  const { slug: rawSlug } = await ctx.params
  const slug = rawSlug.replace(/\.(jpe?g|png|webp|gif|avif)$/i, '')

  let file
  try {
    const target = await getLinkTarget(slug)
    if (target.link.kind !== 'image') return new Response('Not found', { status: 404 })
    file = target.file
  } catch (err) {
    const status = err instanceof AppError ? err.status : 404
    return new Response(status === 410 ? 'Link no longer available' : 'Not found', { status })
  }

  if (file.isFolder || !file.mimeType.startsWith('image/')) return new Response('Not found', { status: 404 })

  const upstream = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${await getAccessToken(file.driveAccountId)}` }, signal: req.signal },
  )
  if (!upstream.ok || !upstream.body) return new Response('Image unavailable', { status: 502 })

  const headers = new Headers()
  headers.set('content-type', file.mimeType)
  const length = upstream.headers.get('content-length')
  if (length) headers.set('content-length', length)
  headers.set('cache-control', 'public, s-maxage=31536000, immutable')
  headers.set('x-content-type-options', 'nosniff')

  return new Response(upstream.body, { status: 200, headers })
}
