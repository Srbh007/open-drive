import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { getLinkInfo } from '@/server/links'
import { rateLimit } from '@/server/ratelimit'
import { getAccessToken } from '@/server/google/tokens'

export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await rateLimit.limit(`image_route_${ip}`)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { slug: rawSlug } = await ctx.params
  const slug = rawSlug.replace(/\.(jpg|png|webp)$/i, '')

  let link
  try {
    link = await getLinkInfo(slug)
  } catch (err: unknown) {
    return new Response((err as Error).message || 'Not found', { status: (err as { status?: number }).status || 404 })
  }

  if (link.kind !== 'image') return new Response('Not an image link', { status: 403 })

  const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!file) return new Response('File not found', { status: 404 })

  if (!file.mimeType.startsWith('image/')) return new Response('Not an image file', { status: 400 })

  const token = await getAccessToken(file.driveAccountId)
  const upstream = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: req.signal,
    },
  )

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', { status: 502 })
  }

  const headers = new Headers()
  headers.set('content-type', file.mimeType)
  headers.set('cache-control', 'public, s-maxage=31536000, immutable')

  return new Response(upstream.body, { status: upstream.status, headers })
}
