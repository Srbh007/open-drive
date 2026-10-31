import { describe, it, expect, vi, beforeEach } from 'vitest'

const settingsRows: { key: string; value: string }[] = []

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => settingsRows }),
      }),
    }),
  },
}))

import { hasBlockedExtension, parseUploadInput, DEFAULT_MAX_UPLOAD_BYTES } from './upload-rules'

describe('upload rules', () => {
  beforeEach(() => {
    settingsRows.length = 0
  })

  it('detects executable and script extensions case-insensitively', () => {
    expect(hasBlockedExtension('setup.EXE')).toBe(true)
    expect(hasBlockedExtension('run.ps1')).toBe(true)
    expect(hasBlockedExtension('photo.jpg')).toBe(false)
    expect(hasBlockedExtension('README')).toBe(false)
  })

  it('blocks executables only on public uploads', async () => {
    const body = { name: 'tool.exe', mimeType: 'application/octet-stream', size: 10 }
    await expect(parseUploadInput(body, true)).rejects.toMatchObject({ status: 400 })
    await expect(parseUploadInput(body, false)).resolves.toMatchObject({ name: 'tool.exe' })
  })

  it('rejects names with path separators and empty or invalid sizes', async () => {
    await expect(parseUploadInput({ name: '../x.jpg', size: 10 }, false)).rejects.toMatchObject({ status: 400 })
    await expect(parseUploadInput({ name: 'a.jpg', size: 0 }, false)).rejects.toMatchObject({ status: 400 })
    await expect(parseUploadInput({ name: 'a.jpg', size: 1.5 }, false)).rejects.toMatchObject({ status: 400 })
  })

  it('enforces the default 5 GB cap and a configured cap', async () => {
    await expect(parseUploadInput({ name: 'big.mp4', size: DEFAULT_MAX_UPLOAD_BYTES + 1 }, false)).rejects.toMatchObject({ status: 400 })
    settingsRows.push({ key: 'upload_max_bytes', value: '100' })
    await expect(parseUploadInput({ name: 'a.jpg', size: 101 }, false)).rejects.toMatchObject({ status: 400 })
    await expect(parseUploadInput({ name: 'a.jpg', size: 100 }, false)).resolves.toMatchObject({ size: 100 })
  })
})
