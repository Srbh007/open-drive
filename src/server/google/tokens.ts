import 'server-only'
import { env } from '@/env'
import { db } from '@/server/db'
import { driveAccounts } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/server/crypto'
import { redis } from '@/server/redis'

export async function getAccessToken(driveAccountId: string): Promise<string> {
  const cacheKey = `drive:${driveAccountId}:at`
  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  const [account] = await db.select().from(driveAccounts).where(eq(driveAccounts.id, driveAccountId)).limit(1)
  if (!account) throw new Error('Drive account not found')
  if (account.status === 'reconnect') throw new Error('Drive account needs reconnection')

  const refreshToken = decrypt(account.refreshTokenEnc)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.AUTH_GOOGLE_ID,
      client_secret: env.AUTH_GOOGLE_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const json = await res.json()

  if (!res.ok) {
    if (json.error === 'invalid_grant') {
      await db.update(driveAccounts).set({ status: 'reconnect' }).where(eq(driveAccounts.id, driveAccountId))
      throw new Error('invalid_grant: Drive account needs reconnection')
    }
    throw new Error(`Failed to refresh token: ${json.error}`)
  }

  const { access_token, expires_in } = json

  if (access_token && expires_in) {
    const ttl = Math.max(expires_in - 300, 60)
    await redis.set(cacheKey, access_token, { ex: ttl })
  }

  return access_token
}
