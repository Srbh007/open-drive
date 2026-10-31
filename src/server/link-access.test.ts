import { describe, it, expect, vi } from 'vitest'

vi.mock('@/env', () => ({ env: { AUTH_SECRET: 'test-secret' } }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { createUnlockToken, isValidUnlockToken, clientIp } from './link-access'

const SLUG = 'abcdefghijklmnopqrstu'

describe('link unlock tokens', () => {
  it('accepts a fresh token for the same slug', () => {
    expect(isValidUnlockToken(SLUG, createUnlockToken(SLUG))).toBe(true)
  })

  it('rejects a token for another slug, a tampered token and a missing token', () => {
    const token = createUnlockToken(SLUG)
    expect(isValidUnlockToken('zzzzzzzzzzzzzzzzzzzzz', token)).toBe(false)
    expect(isValidUnlockToken(SLUG, token.slice(0, -2) + 'xx')).toBe(false)
    expect(isValidUnlockToken(SLUG, undefined)).toBe(false)
  })

  it('rejects an expired token', () => {
    const issued = Date.now() - 13 * 60 * 60 * 1000
    expect(isValidUnlockToken(SLUG, createUnlockToken(SLUG, issued))).toBe(false)
  })

  it('takes the first X-Forwarded-For address', () => {
    const req = new Request('https://x.test', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })
    expect(clientIp(req)).toBe('1.2.3.4')
  })
})
