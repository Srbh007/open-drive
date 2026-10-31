import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { db } from '@/server/db'

vi.mock('@/server/guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  requireDriveAccess: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/server/db', () => ({
  db: {
    query: {
      files: {
        findMany: vi.fn().mockResolvedValue([{ id: 'file-1', name: 'File 1' }])
      }
    }
  },
  sql: vi.fn()
}))

describe('Search API', () => {
  it('returns 400 if q is missing', async () => {
    const req = new Request('http://localhost/api/search')
    const res = await GET(req) as Response
    expect(res.status).toBe(400)
  })

  it('searches correctly with query parameters', async () => {
    const req = new Request('http://localhost/api/search?q=test')
    const res = await GET(req) as Response
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
  })
})
