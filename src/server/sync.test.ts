import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performInitialScan, performIncrementalSync } from './sync'
import { db } from './db'
import { syncState, files, driveAccounts } from './db/schema'
import { listScanFiles, getStartPageToken, listChanges, getDriveAbout } from './google/changes'

vi.mock('./db', () => ({
  db: {
    query: {
      syncState: {
        findFirst: vi.fn(),
      }
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]), onConflictDoUpdate: vi.fn().mockResolvedValue([]) }) }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
  },
  sql: vi.fn((str) => str),
  and: vi.fn(),
  inArray: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('./google/changes', () => ({
  listScanFiles: vi.fn(),
  getStartPageToken: vi.fn(),
  listChanges: vi.fn(),
  getDriveAbout: vi.fn(),
}))

describe('Sync Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('performs initial scan and saves startPageToken', async () => {
    vi.mocked(db.query.syncState.findFirst).mockResolvedValueOnce(undefined)

    vi.mocked(listScanFiles).mockResolvedValueOnce({
      files: [{ id: 'file1', name: 'File 1', mimeType: 'text/plain', size: '100' }],
      nextPageToken: undefined
    })

    vi.mocked(getStartPageToken).mockResolvedValueOnce('token123')

    await performInitialScan('drive-1')

    expect(listScanFiles).toHaveBeenCalledWith('drive-1', undefined)
    expect(db.insert).toHaveBeenCalledWith(files)
    expect(db.update).toHaveBeenCalledWith(syncState)
  })

  it('performs incremental sync handling trashed files', async () => {
    vi.mocked(db.query.syncState.findFirst).mockResolvedValueOnce({
      driveAccountId: 'drive-1',
      pageToken: 'token123',
      scanPageToken: null,
      status: 'synced',
      error: null,
      updatedAt: new Date()
    })

    vi.mocked(listChanges).mockResolvedValueOnce({
      changes: [
        { type: 'file', removed: true, fileId: 'file1', time: '2023-01-01' },
        { type: 'file', removed: false, fileId: 'file2', time: '2023-01-01', file: { id: 'file2', name: 'File 2', mimeType: 'text/plain', size: '100' } }
      ],
      newStartPageToken: 'token456'
    })

    vi.mocked(getDriveAbout).mockResolvedValueOnce({
      user: { emailAddress: 'test@test.com' },
      storageQuota: { usage: '1000' }
    })

    await performIncrementalSync('drive-1')

    expect(listChanges).toHaveBeenCalledWith('drive-1', 'token123')
    expect(db.delete).toHaveBeenCalledWith(files)
    expect(db.insert).toHaveBeenCalledWith(files)
    expect(db.update).toHaveBeenCalledWith(syncState)
    expect(db.update).toHaveBeenCalledWith(driveAccounts)
  })
})
