import { describe, it, expect, vi, beforeEach } from 'vitest'

const createResumableSession = vi.fn()
// Each db.select(...).from(...).where(...).limit() call pops the next queued result.
const dbResults: unknown[][] = []

vi.mock('@/server/guard', () => ({
  requireUser: async () => ({ id: 'u1', role: 'editor' }),
  requireDriveAccess: async () => undefined,
}))
vi.mock('@/server/upload-rules', () => ({
  parseUploadInput: async (body: { name: string; size: number }) => ({ name: body.name, mimeType: 'image/jpeg', size: body.size }),
}))
vi.mock('@/server/google/upload', () => ({ createResumableSession: (...a: unknown[]) => createResumableSession(...a) }))
vi.mock('@/server/google/tokens', () => ({ getAccessToken: async () => 'token' }))
vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => dbResults.shift() ?? [] }),
      }),
    }),
  },
}))

import { POST } from './route'

const DRIVE = '22222222-2222-4222-8222-222222222222'
const FOLDER = '33333333-3333-4333-8333-333333333333'
const drive = { id: DRIVE, status: 'active', quotaUsed: 0, quotaTotal: 1000, rootFolderId: 'ROOT_GID' }

function post(body: unknown) {
  return POST(new Request('https://x.test/api/upload-session', { method: 'POST', body: JSON.stringify(body) }))
}

describe('POST /api/upload-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbResults.length = 0
    createResumableSession.mockResolvedValue('https://upload.example/session')
  })

  it('uploads to the Drive root when no folder is given', async () => {
    dbResults.push([drive])
    const res = await post({ driveAccountId: DRIVE, name: 'a.jpg', size: 10 })
    expect(res.status).toBe(200)
    expect(createResumableSession).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'ROOT_GID' }))
  })

  it('refuses a folder id that is not a folder in this Drive', async () => {
    dbResults.push([drive], []) // folder lookup scoped to this Drive finds nothing
    const res = await post({ driveAccountId: DRIVE, folderId: FOLDER, name: 'a.jpg', size: 10 })
    expect(res.status).toBe(404)
    expect(createResumableSession).not.toHaveBeenCalled()
  })

  it('refuses uploads that do not fit in the Drive', async () => {
    dbResults.push([{ ...drive, quotaUsed: 995 }])
    expect((await post({ driveAccountId: DRIVE, name: 'a.jpg', size: 10 })).status).toBe(409)
  })

  it('never accepts raw Google ids as the target', async () => {
    const res = await post({ driveAccountId: DRIVE, folderId: 'ROOT_GID', name: 'a.jpg', size: 10 })
    expect(res.status).toBe(400)
  })
})
