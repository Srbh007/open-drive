import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { fetchWithToken, COMMON_FIELDS } from '@/server/google/drive'
import { toFileItem } from '@/server/file-dto'

const IdParamSchema = z.object({
  id: z.string().uuid()
})

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  title: z.string().max(500).optional(),
  moveToFolderId: z.string().uuid().optional(),
})

export const GET = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params
  const { id } = IdParamSchema.parse(resolvedParams)

  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, false)

  let parentId: string | null = null
  if (file.parentProviderId) {
    const parentFolder = await db.query.files.findFirst({
      where: and(
        eq(files.providerFileId, file.parentProviderId),
        eq(files.driveAccountId, file.driveAccountId)
      ),
      columns: { id: true }
    })
    if (parentFolder) {
      parentId = parentFolder.id
    }
  }

  return toFileItem(file, parentId)
})

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params
  const { id } = IdParamSchema.parse(resolvedParams)

  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, true)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid body', 400)

  const { name, title, moveToFolderId } = parsed.data

  if (title !== undefined) {
    await db.update(files).set({ title }).where(eq(files.id, id))
  }

  if (name || moveToFolderId) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.providerFileId}`)
    url.searchParams.set('fields', COMMON_FIELDS)

    if (moveToFolderId) {
      const targetFolder = await db.query.files.findFirst({
        where: and(
          eq(files.id, moveToFolderId),
          eq(files.driveAccountId, file.driveAccountId),
          eq(files.isFolder, true)
        )
      })
      if (!targetFolder) throw new AppError('NOT_FOUND', 'Target folder not found', 404)

      url.searchParams.set('addParents', targetFolder.providerFileId)
      if (file.parentProviderId) {
        url.searchParams.set('removeParents', file.parentProviderId)
      }
    }

    const res = await fetchWithToken(file.driveAccountId, url.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(name ? { name } : {})
    })

    if (!res.ok) {
      throw new AppError('UPSTREAM_ERROR', `Google Drive API error: ${res.statusText}`, res.status)
    }

    const updated = await res.json()
    await db.update(files).set({
      name: updated.name,
      parentProviderId: updated.parents?.[0] || null,
      modifiedAt: updated.modifiedTime ? new Date(updated.modifiedTime) : new Date(),
      version: updated.modifiedTime,
    }).where(eq(files.id, id))
  }

  return { success: true }
})

export const DELETE = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params
  const { id } = IdParamSchema.parse(resolvedParams)

  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, true)

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.providerFileId}`)
  const res = await fetchWithToken(file.driveAccountId, url.toString(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: true })
  })

  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Google Drive API error: ${res.statusText}`, res.status)
  }

  await db.update(files).set({ trashed: true }).where(eq(files.id, id))

  return { success: true }
})
