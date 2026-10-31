import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'
import { env } from '@/env'

vi.mock('@/env', () => ({
  env: {
    CRON_SECRET: 'test-secret'
  }
}))

vi.mock('@/server/sync', () => ({
  performIncrementalSync: vi.fn()
}))

vi.mock('@/server/db', () => ({
  db: {
    query: {
      driveAccounts: {
        findMany: vi.fn().mockResolvedValue([])
      }
    }
  }
}))

describe('Cron Sync API', () => {
  it('returns 401 for missing auth header', async () => {
    const req = new Request('http://localhost/api/cron/sync')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid auth header', async () => {
    const req = new Request('http://localhost/api/cron/sync', {
      headers: { 'Authorization': 'Bearer wrong-secret' }
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 for valid auth header', async () => {
    const req = new Request('http://localhost/api/cron/sync', {
      headers: { 'Authorization': `Bearer test-secret` }
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
