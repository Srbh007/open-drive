import { AppError, withRoute } from '@/server/errors'
import { getLinkTarget } from '@/server/links'
import { uploadLimit } from '@/server/ratelimit'
import { clientIp, requireUnlocked } from '@/server/link-access'
import { createResumableSession } from '@/server/google/upload'
import { getAccessToken } from '@/server/google/tokens'
import { parseUploadInput } from '@/server/upload-rules'

export const POST = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const ip = clientIp(req)
  if (!(await uploadLimit.limit(ip)).success) throw new AppError('RATE_LIMITED', 'Too many requests', 429)

  const { slug } = await ctx.params
  const { link, file } = await getLinkTarget(slug)
  if (link.kind !== 'edit') throw new AppError('FORBIDDEN', 'This link does not allow uploads', 403)
  await requireUnlocked(link)

  const input = await parseUploadInput(await req.json().catch(() => ({})), true)

  // A folder link uploads new files INTO that folder; a file link replaces that file's content.
  const sessionUrl = await createResumableSession({
    accessToken: await getAccessToken(file.driveAccountId),
    name: file.isFolder ? input.name : file.name,
    mimeType: input.mimeType,
    size: input.size,
    parentId: file.isFolder ? file.providerFileId : (file.parentProviderId ?? file.providerFileId),
    replaceFileId: file.isFolder ? undefined : file.providerFileId,
  })

  return { sessionUrl }
})
