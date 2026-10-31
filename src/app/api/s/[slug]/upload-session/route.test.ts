import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/server/errors'

const getLinkTarget = vi.fn()
const requireUnlocked = vi.fn()
const createResumableSession = vi.fn()

vi.mock('@/server/links', () => ({ getLinkTarget: (...a: unknown[]) => getLinkTarget(...a) }))
vi.mock('@/server/ratelimit', () => ({ uploadLimit: { limit: async () => ({ success: true }) } }))
vi.mock('@/server/link-access', () => ({
  clientIp: () => '1.2.3.4',
  requireUnlocked: (...a: unknown[]) => requireUnlocked(...a),
}))
vi.mock('@/server/google/upload', () => ({ createResumableSession: (...a: unknown[]) => createResumableSession(...a) }))
vi.mock('@/server/google/tokens', () => ({ getAccessToken: async () => 'token' }))
vi.mock('@/server/upload-rules', async () => {
  const { AppError: Err } = await import('@/server/errors')
  return {
    parseUploadInput: async (body: { name: string; size: number }, publicUpload: boolean) => {
      if (publicUpload && body.name.endsWith('.exe')) throw new Err('VALIDATION', 'blocked', 400)
      return { name: body.name, mimeType: 'image/jpeg', size: body.size }
    },
  }
})

import { POST } from './route'

const SLUG = 'abcdefghijklmnopqrstu'
const folder = { isFolder: true, name: 'Products', providerFileId: 'FOLDER_GID', parentProviderId: 'PARENT_GID', driveAccountId: 'd1' }
const file = { isFolder: false, name: 'old.jpg', providerFileId: 'FILE_GID', parentProviderId: 'PARENT_GID', driveAccountId: 'd1' }

function post(body: unknown) {
  return POST(new Request(`https://x.test/api/s/${SLUG}/upload-session`, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ slug: SLUG }),
  })
}

describe('POST /api/s/[slug]/upload-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUnlocked.mockResolvedValue(undefined)
    createResumableSession.mockResolvedValue('https://upload.example/session')
  })

  it('uploads into the linked folder itself, not its parent', async () => {
    getLinkTarget.mockResolvedValue({ link: { kind: 'edit', slug: SLUG, passwordHash: null }, file: folder })
    const res = await post({ name: 'new.jpg', size: 100 })
    expect(res.status).toBe(200)
    expect(createResumableSession).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'FOLDER_GID', replaceFileId: undefined, name: 'new.jpg' }))
  })

  it('replaces the linked file for a file link', async () => {
    getLinkTarget.mockResolvedValue({ link: { kind: 'edit', slug: SLUG, passwordHash: null }, file })
    await post({ name: 'whatever.jpg', size: 100 })
    expect(createResumableSession).toHaveBeenCalledWith(expect.objectContaining({ replaceFileId: 'FILE_GID', name: 'old.jpg' }))
  })

  it('refuses view links', async () => {
    getLinkTarget.mockResolvedValue({ link: { kind: 'view', slug: SLUG, passwordHash: null }, file: folder })
    expect((await post({ name: 'new.jpg', size: 100 })).status).toBe(403)
    expect(createResumableSession).not.toHaveBeenCalled()
  })

  it('requires the password unlock for protected links', async () => {
    getLinkTarget.mockResolvedValue({ link: { kind: 'edit', slug: SLUG, passwordHash: 'h' }, file: folder })
    requireUnlocked.mockRejectedValue(new AppError('UNAUTHENTICATED', 'This link needs a password', 401))
    expect((await post({ name: 'new.jpg', size: 100 })).status).toBe(401)
    expect(createResumableSession).not.toHaveBeenCalled()
  })

  it('blocks executable uploads', async () => {
    getLinkTarget.mockResolvedValue({ link: { kind: 'edit', slug: SLUG, passwordHash: null }, file: folder })
    expect((await post({ name: 'tool.exe', size: 100 })).status).toBe(400)
    expect(createResumableSession).not.toHaveBeenCalled()
  })
})
