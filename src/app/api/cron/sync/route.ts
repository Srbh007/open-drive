import 'server-only'
import { env } from '@/env'
import { db } from '@/server/db'
import { driveAccounts } from '@/server/db/schema'
import { performIncrementalSync } from '@/server/sync'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { log } from '@/server/log'
import { timingSafeEqual } from 'crypto'

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization')

  // Constant-time compare for auth
  const expectedPrefix = 'Bearer '
  let isValid = false
  if (authHeader && authHeader.startsWith(expectedPrefix)) {
    const token = authHeader.substring(expectedPrefix.length)
    const tokenBuffer = Buffer.from(token)
    const secretBuffer = Buffer.from(env.CRON_SECRET)

    if (tokenBuffer.length === secretBuffer.length) {
      isValid = timingSafeEqual(tokenBuffer, secretBuffer)
    }
  }

  if (!isValid) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }, { status: 401 })
  }

  const startTime = Date.now()
  const TIME_BUDGET_MS = 240 * 1000 // 240 seconds
  let drivesProcessed = 0
  let drivesFailed = 0

  try {
    // Process oldest synced first
    const drives = await db.query.driveAccounts.findMany({
      where: eq(driveAccounts.status, 'active'),
      orderBy: [asc(driveAccounts.lastSyncedAt)],
    })

    for (const drive of drives) {
      const elapsed = Date.now() - startTime
      if (elapsed > TIME_BUDGET_MS) {
        log.info(`Sync time budget exceeded after processing ${drivesProcessed} drives.`)
        break
      }

      const remainingTime = TIME_BUDGET_MS - elapsed

      try {
        await performIncrementalSync(drive.id, remainingTime)
        drivesProcessed++
      } catch (error: unknown) {
        log.error(`Sync failed for drive ${drive.id}`, error)
        drivesFailed++
      }
    }

    return NextResponse.json({ ok: true, data: { processed: drivesProcessed, failed: drivesFailed } })
  } catch (error: unknown) {
    log.error('Sync cron failed', error)
    return NextResponse.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } }, { status: 500 })
  }
}
