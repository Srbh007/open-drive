import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/server/guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-id', role: 'admin' })
}))

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        id: 'drive-id',
        email: 'test@example.com',
        label: 'Test Drive',
        color: '#000000',
        status: 'active',
        quotaUsed: 0,
        quotaTotal: 100,
        lastSyncedAt: null,
      }])
    })
  }
}))

vi.mock('@/server/db/schema', () => ({
  driveAccounts: {
    id: 'id',
    email: 'email',
    label: 'label',
    color: 'color',
    status: 'status',
    quotaUsed: 'quotaUsed',
    quotaTotal: 'quotaTotal',
    lastSyncedAt: 'lastSyncedAt',
    refreshTokenEnc: 'refreshTokenEnc', // should not be accessed
  },
  userDriveAccess: {
    driveAccountId: 'driveAccountId',
    userId: 'userId',
  }
}))

describe('GET /api/drives', () => {
  it('returns safe columns without refreshTokenEnc', async () => {
    const req = new Request('http://localhost/api/drives')
    const res = await GET(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data[0]).not.toHaveProperty('refreshTokenEnc')
    expect(json.data[0]).toHaveProperty('id')
  })
})
