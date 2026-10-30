import 'server-only'
import { db } from '@/server/db'
import { auditLog } from '@/server/db/schema'

export async function writeAudit(
  action: string,
  target?: string,
  userId?: string,
  linkSlug?: string,
  ip?: string
) {
  await db.insert(auditLog).values({
    action,
    target,
    userId,
    linkSlug,
    ip
  })
}
