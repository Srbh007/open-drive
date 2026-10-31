import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files, driveAccounts } from '@/server/db/schema'
import { eq, and, desc, asc, isNull } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { toFileItem } from '@/server/file-dto'

const QuerySchema = z.object({
  drive: z.string().uuid(),
  parent: z.string().uuid().optional(),
  sortKey: z.enum(['name', 'modifiedAt', 'size']).default('name'),
  sortDesc: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().min(1).max(1000).default(1000),
  offset: z.coerce.number().min(0).default(0),
})

export const GET = withRoute(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid query parameters', 400)
  }

  const { drive: driveAccountId, parent, sortKey, sortDesc, limit, offset } = parsed.data
  await requireDriveAccess(user, driveAccountId, false)

  let parentProviderId: string | null = null

  if (!parent) {
    const drive = await db.query.driveAccounts.findFirst({
      where: eq(driveAccounts.id, driveAccountId)
    })
    if (!drive) throw new AppError('NOT_FOUND', 'Drive not found', 404)
    parentProviderId = drive.rootFolderId
  } else {
    const folder = await db.query.files.findFirst({
      where: and(
        eq(files.id, parent),
        eq(files.driveAccountId, driveAccountId),
        eq(files.isFolder, true),
        eq(files.trashed, false)
      )
    })
    if (!folder) throw new AppError('NOT_FOUND', 'Folder not found', 404)
    parentProviderId = folder.providerFileId
  }

  const isDesc = sortDesc === 'true'
  const orderByFields = [desc(files.isFolder)]

  if (sortKey === 'name') {
    orderByFields.push(isDesc ? desc(files.name) : asc(files.name))
  } else if (sortKey === 'modifiedAt') {
    orderByFields.push(isDesc ? desc(files.modifiedAt) : asc(files.modifiedAt))
  } else if (sortKey === 'size') {
    orderByFields.push(isDesc ? desc(files.size) : asc(files.size))
  }

  const children = await db.query.files.findMany({
    where: and(
      eq(files.driveAccountId, driveAccountId),
      parentProviderId === 'root' ? isNull(files.parentProviderId) : eq(files.parentProviderId, parentProviderId),
      eq(files.trashed, false)
    ),
    orderBy: orderByFields,
    limit,
    offset
  })

  // Since all children belong to the same parent, we know their parentId is `parent || rootId mapping`.
  // Wait, if parent is omitted, we might want to return `null` or a known root id for `parentId`.
  return children.map(row => toFileItem(row, parent || null))
})
