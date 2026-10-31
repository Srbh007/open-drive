import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '@/env'
import { AppError } from '@/server/errors'

const UNLOCK_TTL_SECONDS = 12 * 60 * 60

export function unlockCookieName(slug: string): string {
  return `od_link_${slug}`
}

function sign(slug: string, expiresAt: number): string {
  return createHmac('sha256', env.AUTH_SECRET).update(`${slug}.${expiresAt}`).digest('base64url')
}

export function createUnlockToken(slug: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + UNLOCK_TTL_SECONDS
  return `${expiresAt}.${sign(slug, expiresAt)}`
}

export function isValidUnlockToken(slug: string, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false
  const [expPart, sig] = token.split('.')
  const expiresAt = Number(expPart)
  if (!sig || !Number.isInteger(expiresAt) || expiresAt * 1000 < now) return false
  const expected = Buffer.from(sign(slug, expiresAt))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export async function setUnlockCookie(slug: string): Promise<void> {
  const store = await cookies()
  store.set(unlockCookieName(slug), createUnlockToken(slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: UNLOCK_TTL_SECONDS,
  })
}

export async function hasUnlockedLink(slug: string): Promise<boolean> {
  const store = await cookies()
  return isValidUnlockToken(slug, store.get(unlockCookieName(slug))?.value)
}

/** Throws 401 when the link has a password and the visitor has not unlocked it. */
export async function requireUnlocked(link: { slug: string; passwordHash: string | null }): Promise<void> {
  if (link.passwordHash && !(await hasUnlockedLink(link.slug))) {
    throw new AppError('UNAUTHENTICATED', 'This link needs a password', 401)
  }
}

/** First address in X-Forwarded-For, for rate-limit keys and audit rows. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
