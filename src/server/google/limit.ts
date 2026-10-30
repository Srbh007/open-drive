import 'server-only'
import { AppError } from '@/server/errors'
import { log } from '@/server/log'

const inFlight = new Map<string, number>()

export async function fetchWithBackoff(driveAccountId: string, url: string, init?: RequestInit): Promise<Response> {
  const MAX_CONCURRENT = 3
  const current = inFlight.get(driveAccountId) || 0

  if (current >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300))
  }

  inFlight.set(driveAccountId, (inFlight.get(driveAccountId) || 0) + 1)
  let attempt = 0

  try {
    while (attempt < 4) {
      const res = await fetch(url, init)

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000
        log.warn(`Google Drive API rate limit/error ${res.status}, backing off ${Math.round(backoff)}ms`)
        await new Promise(r => setTimeout(r, backoff))
        attempt++
        continue
      }
      return res
    }
    throw new AppError('UPSTREAM_ERROR', 'Google Drive API repeatedly failed', 502)
  } finally {
    const val = inFlight.get(driveAccountId) || 1
    if (val <= 1) {
      inFlight.delete(driveAccountId)
    } else {
      inFlight.set(driveAccountId, val - 1)
    }
  }
}
