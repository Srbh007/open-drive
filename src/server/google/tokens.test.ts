import { describe, it, expect, vi } from 'vitest'
import { getAccessToken } from './tokens'
import { redis } from '@/server/redis'

vi.mock('@/server/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/server/crypto', () => ({
  decrypt: vi.fn().mockReturnValue('mock-refresh-token')
}))

vi.mock('@/server/db', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mock-drive-id', status: 'active', refreshTokenEnc: 'enc' }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    }
  }
})

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ access_token: 'mock-access', expires_in: 3600 })
})

describe('Tokens', () => {
  it('refreshes token on cache miss', async () => {
    const token = await getAccessToken('mock-drive-id')
    expect(token).toBe('mock-access')
    expect(redis.set).toHaveBeenCalled()
  })
})
