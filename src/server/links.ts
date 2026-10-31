import 'server-only'
import { eq, and, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/server/db'
import { links, files, driveAccounts } from '@/server/db/schema'
import { AppError } from '@/server/errors'

export type LinkKind = "edit" | "view" | "image"

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    try {
      const derivedKey = scryptSync(password, salt, 64)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    } catch (err) {
      reject(err)
    }
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':')
    if (!salt || !key) {
      resolve(false)
      return
    }
    try {
      const keyBuffer = Buffer.from(key, 'hex')
      const derivedKey = scryptSync(password, salt, 64)
      resolve(timingSafeEqual(keyBuffer, derivedKey))
    } catch (err) {
      reject(err)
    }
  })
}

export async function getOrCreateLink(
  fileId: string,
  kind: LinkKind,
  userId?: string,
  expiresAt?: Date | null,
  passwordHash?: string | null
): Promise<string> {
  const [existing] = await db
    .select()
    .from(links)
    .where(and(eq(links.fileId, fileId), eq(links.kind, kind), isNull(links.revokedAt)))
    .limit(1)

  if (existing) {
    if (expiresAt !== undefined || passwordHash !== undefined) {
      const updateData: Record<string, unknown> = {}
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt
      if (passwordHash !== undefined) updateData.passwordHash = passwordHash
      
      if (Object.keys(updateData).length > 0) {
        await db.update(links).set(updateData).where(eq(links.id, existing.id))
      }
    }
    return existing.slug
  }

  const slug = nanoid(21)
  await db.insert(links).values({
    slug,
    kind,
    fileId,
    createdBy: userId || null,
    expiresAt,
    passwordHash,
  })

  return slug
}

export async function getLinkInfo(slug: string) {
  if (!/^[A-Za-z0-9_-]{21}$/.test(slug)) throw new AppError('NOT_FOUND', 'Link not found', 404)
  const [link] = await db.select().from(links).where(eq(links.slug, slug)).limit(1)
  if (!link) throw new AppError('NOT_FOUND', 'Link not found', 404)
  if (link.revokedAt) throw new AppError('GONE', 'Link revoked', 410)
  if (link.expiresAt && link.expiresAt < new Date()) throw new AppError('GONE', 'Link expired', 410)
  return link
}

/** A usable public link: not revoked/expired, file not trashed, Drive still connected. */
export async function getLinkTarget(slug: string) {
  const link = await getLinkInfo(slug)
  const [row] = await db
    .select({ file: files, driveStatus: driveAccounts.status, rootFolderId: driveAccounts.rootFolderId })
    .from(files)
    .innerJoin(driveAccounts, eq(files.driveAccountId, driveAccounts.id))
    .where(eq(files.id, link.fileId))
    .limit(1)
  if (!row || row.file.trashed) throw new AppError('NOT_FOUND', 'Link not found', 404)
  if (row.driveStatus !== 'active') throw new AppError('GONE', 'This file is temporarily unavailable', 410)
  return { link, file: row.file }
}
