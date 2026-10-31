import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/server/errors'

const requireUser = vi.fn()
const requireDriveAccess = vi.fn()
const getFileForUser = vi.fn()
const getOrCreateLink = vi.fn()
let defaultKindSetting: string | null = null

vi.mock('@/server/guard', () => ({ requireUser: () => requireUser(), requireDriveAccess: (...a: unknown[]) => requireDriveAccess(...a) }))
vi.mock('@/server/files', () => ({ getFileForUser: (...a: unknown[]) => getFileForUser(...a) }))
vi.mock('@/server/links', () => ({
  getOrCreateLink: (...a: unknown[]) => getOrCreateLink(...a),
  hashPassword: async (p: string) => `hashed:${p}`,
}))
vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (defaultKindSetting ? [{ key: 'copy_link_default', value: defaultKindSetting }] : []) }),
      }),
    }),
  },
}))

import { POST } from './route'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const viewer = { id: 'u1', role: 'viewer' }
const imageFile = { id: FILE_ID, driveAccountId: 'd1', isFolder: false, mimeType: 'image/png' }
const pdfFile = { id: FILE_ID, driveAccountId: 'd1', isFolder: false, mimeType: 'application/pdf' }

function post(body: unknown) {
  return POST(new Request('https://x.test/api/links', { method: 'POST', body: JSON.stringify(body) }))
}

describe('POST /api/links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultKindSetting = null
    requireUser.mockResolvedValue(viewer)
    getFileForUser.mockResolvedValue(pdfFile)
    getOrCreateLink.mockResolvedValue('abcdefghijklmnopqrstu')
    requireDriveAccess.mockRejectedValue(new AppError('FORBIDDEN', 'Edit rights required', 403))
  })

  it('refuses an explicit edit link for a user without edit rights', async () => {
    const res = await post({ fileId: FILE_ID, kind: 'edit' })
    expect(res.status).toBe(403)
    expect(getOrCreateLink).not.toHaveBeenCalled()
  })

  it('falls back to a view link when the default is edit but the user cannot edit', async () => {
    const res = await post({ fileId: FILE_ID })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.kind).toBe('view')
    expect(getOrCreateLink).toHaveBeenCalledWith(FILE_ID, 'view', 'u1', null, null)
  })

  it('creates an edit link when the user has edit rights', async () => {
    requireDriveAccess.mockResolvedValue(undefined)
    const res = await post({ fileId: FILE_ID, kind: 'edit' })
    expect((await res.json()).data.kind).toBe('edit')
  })

  it('only allows image links for image files', async () => {
    expect((await post({ fileId: FILE_ID, kind: 'image' })).status).toBe(400)
    getFileForUser.mockResolvedValue(imageFile)
    expect((await post({ fileId: FILE_ID, kind: 'image' })).status).toBe(200)
  })

  it('rejects invalid input', async () => {
    expect((await post({ fileId: 'not-a-uuid' })).status).toBe(400)
    expect((await post({ fileId: FILE_ID, password: 'short' })).status).toBe(400)
  })
})
