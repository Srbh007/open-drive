import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/server/guard', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  requireDriveAccess: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/server/file-dto', () => ({
  toFileItem: vi.fn((row, parentId) => ({ ...row, parentId, providerFileId: undefined }))
}))

vi.mock('@/server/db', () => ({
  db: {
    query: {
      driveAccounts: {
        findFirst: vi.fn().mockResolvedValue({ id: 'drive-1', rootFolderId: 'root-id' })
      },
      files: {
        findFirst: vi.fn().mockResolvedValue({ id: 'folder-1', providerFileId: 'provider-folder-1', isFolder: true }),
        findMany: vi.fn().mockResolvedValue([{ id: 'file-1', name: 'File 1', providerFileId: 'secret-id' }])
      }
    }
  }
}))

describe('Folders API', () => {
  it('returns 400 for invalid query', async () => {
    const req = new Request('http://localhost/api/folders') // missing drive
    const res = await GET(req) as Response
    expect(res.status).toBe(400)
  })

  it('fetches root folder if parent is not specified and strips internal fields', async () => {
    const req = new Request('http://localhost/api/folders?drive=123e4567-e89b-12d3-a456-426614174000')
    const res = await GET(req) as Response
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.length).toBe(1)
    expect(json.data[0].providerFileId).toBeUndefined()
  })
})
