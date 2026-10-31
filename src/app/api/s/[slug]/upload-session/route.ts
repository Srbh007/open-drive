import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { getLinkInfo } from '@/server/links'
import { rateLimit } from '@/server/ratelimit'
import { createResumableSession } from '@/server/google/upload'
import { getAccessToken } from '@/server/google/tokens'
import { AppError } from '@/server/errors'

const uploadSessionSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
})

export const POST = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await rateLimit.limit(`upload_session_${ip}`)
  if (!success) throw new AppError('RATE_LIMITED', 'Too many requests', 429)

  const { slug } = await ctx.params
  const link = await getLinkInfo(slug)
  if (link.kind !== 'edit') throw new AppError('FORBIDDEN', 'Link does not have edit rights', 403)

  const body = await req.json().catch(() => ({}))
  const data = uploadSessionSchema.parse(body)

  const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!file) throw new Error('NOT_FOUND')

  const token = await getAccessToken(file.driveAccountId)
  const sessionUrl = await createResumableSession({
    accessToken: token,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size,
    parentId: file.parentProviderId || 'root',
    replaceFileId: file.isFolder ? undefined : file.providerFileId,
  })

  return { sessionUrl }
})
