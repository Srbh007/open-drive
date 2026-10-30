import 'server-only'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { users, userDriveAccess } from '@/server/db/schema'
import { AppError } from '@/server/errors'

export type CurrentUser = typeof users.$inferSelect

export async function requireUser(): Promise<CurrentUser> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401)
  if (user.status === 'suspended') throw new AppError('UNAUTHENTICATED', 'Account suspended', 401)
  if (user.status !== 'approved') throw new AppError('FORBIDDEN', 'Waiting for owner approval', 403)

  return user
}

export async function requireDriveAccess(
  user: CurrentUser,
  driveAccountId: string,
  needEdit = false,
): Promise<void> {
  if (user.role === 'owner' || user.role === 'admin') return
  if (needEdit && user.role === 'viewer') throw new AppError('FORBIDDEN', 'Edit rights required', 403)

  const [access] = await db
    .select()
    .from(userDriveAccess)
    .where(and(eq(userDriveAccess.userId, user.id), eq(userDriveAccess.driveAccountId, driveAccountId)))
    .limit(1)

  if (!access) throw new AppError('FORBIDDEN', 'No access to this Drive', 403)
  if (needEdit && !access.canEdit) throw new AppError('FORBIDDEN', 'Edit rights required', 403)
}
