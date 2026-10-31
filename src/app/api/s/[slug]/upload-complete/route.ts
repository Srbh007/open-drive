import { z } from 'zod'
import { AppError, withRoute } from '@/server/errors'
import { getLinkTarget } from '@/server/links'
import { uploadLimit } from '@/server/ratelimit'
import { clientIp, requireUnlocked } from '@/server/link-access'
import { indexDriveFile } from '@/server/file-index'
import { writeAudit } from '@/server/audit'

const completeSchema = z.object({
  providerFileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
})

export const POST = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const ip = clientIp(req)
  if (!(await uploadLimit.limit(ip)).success) throw new AppError('RATE_LIMITED', 'Too many requests', 429)

  const { slug } = await ctx.params
  const { link, file } = await getLinkTarget(slug)
  if (link.kind !== 'edit') throw new AppError('FORBIDDEN', 'This link does not allow uploads', 403)
  await requireUnlocked(link)

  const parsed = completeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid input', 400)
  const { providerFileId } = parsed.data

  // Only index the file this link is allowed to touch: the linked file itself, or a direct child of the linked folder.
  if (!file.isFolder && providerFileId !== file.providerFileId) {
    throw new AppError('FORBIDDEN', 'File does not belong to this link', 403)
  }
  const { row, google } = await indexDriveFile(file.driveAccountId, providerFileId)
  if (file.isFolder && !(google.parents ?? []).includes(file.providerFileId)) {
    throw new AppError('FORBIDDEN', 'File does not belong to this link', 403)
  }

  await writeAudit('link.upload', row.id, undefined, slug, ip)
  return { name: row.name, size: row.size }
})
