import { describe, it, expect, vi } from 'vitest'
import { requireUser } from '@/server/guard'

vi.mock('@/server/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'mock-user-id' } })
}))

vi.mock('@/server/db', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mock-user-id', status: 'approved', role: 'viewer' }])
    }
  }
})

describe('Auth Guard', () => {
  it('allows approved users', async () => {
    const user = await requireUser()
    expect(user.id).toBe('mock-user-id')
  })
})
