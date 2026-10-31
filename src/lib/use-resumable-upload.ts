import { useState, useCallback, useRef } from 'react'

export type UploadState = {
  id: string
  file: File
  title: string
  progress: number
  status: 'pending' | 'uploading' | 'paused' | 'error' | 'success'
  error?: string
  link?: string
  imageLink?: string
  fileId?: string
}

type ChunkInfo = {
  start: number
  end: number
  blob: Blob
}

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } }

type CompleteData = { file: { id: string }; linkSlug: string; imageLinkSlug: string | null }

const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB, a multiple of 256 KB as Google requires
const MAX_CONCURRENT = 3

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbort(err: unknown) {
  return err instanceof Error && err.name === 'AbortError'
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = (await res.json().catch(() => ({ ok: false }))) as ApiEnvelope<T>
  if (!json.ok) throw new Error(json.error?.message || 'Request failed')
  return json.data
}

async function uploadChunk(url: string, chunk: ChunkInfo, totalSize: number, signal: AbortSignal): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${chunk.start}-${chunk.end - 1}/${totalSize}` },
        body: chunk.blob,
        signal,
      })
      if (res.ok || res.status === 308) return res
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw new Error(`Upload failed with status ${res.status}`)
      }
    } catch (err) {
      if (isAbort(err)) throw err
    }
    await sleep(delay)
    delay *= 2
  }
  throw new Error('Upload chunk failed after retries')
}

/** Asks Google how much of the file it already has, so an interrupted upload resumes instead of restarting. */
async function getUploadedBytes(url: string, totalSize: number, signal: AbortSignal): Promise<{ next: number; id: string | null }> {
  let delay = 1000
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${totalSize}` }, signal })
      if (res.status === 308) {
        const match = res.headers.get('Range')?.match(/bytes=0-(\d+)/)
        return { next: match ? parseInt(match[1], 10) + 1 : 0, id: null }
      }
      if (res.ok) {
        const body: { id?: string } = await res.json().catch(() => ({}))
        return { next: totalSize, id: body.id ?? null }
      }
    } catch (err) {
      if (isAbort(err)) throw err
    }
    await sleep(delay)
    delay *= 2
  }
  return { next: 0, id: null }
}

/**
 * Uploads files straight from the browser to Google Drive in resumable chunks.
 * `folderId` is OUR folder uuid (undefined = the Drive's root); the server resolves Google ids.
 */
export function useResumableUpload(driveAccountId: string, folderId?: string) {
  const [uploads, setUploads] = useState<UploadState[]>([])
  // Files and titles live in refs so the queue never reads stale React state.
  const items = useRef(new Map<string, { file: File; title: string }>())
  const sessionUrls = useRef(new Map<string, string>())
  const activeUploads = useRef(new Set<string>())
  const queue = useRef<string[]>([])
  const abortControllers = useRef(new Map<string, AbortController>())
  const target = useRef({ driveAccountId, folderId })
  target.current = { driveAccountId, folderId }

  const patch = useCallback((id: string, changes: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)))
  }, [])

  const runOne = useCallback(
    async (id: string) => {
      const item = items.current.get(id)
      if (!item) return
      const { file } = item
      const controller = new AbortController()
      abortControllers.current.set(id, controller)
      patch(id, { status: 'uploading' })

      try {
        let url = sessionUrls.current.get(id)
        if (!url) {
          const data = await postJson<{ sessionUrl: string }>('/api/upload-session', {
            driveAccountId: target.current.driveAccountId,
            folderId: target.current.folderId,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
          })
          url = data.sessionUrl
          sessionUrls.current.set(id, url)
        }

        let { next: startByte, id: providerFileId } = await getUploadedBytes(url, file.size, controller.signal)
        while (startByte < file.size) {
          const endByte = Math.min(startByte + CHUNK_SIZE, file.size)
          const res = await uploadChunk(url, { start: startByte, end: endByte, blob: file.slice(startByte, endByte) }, file.size, controller.signal)
          startByte = endByte
          patch(id, { progress: (startByte / file.size) * 100 })
          if (res.ok) {
            const body: { id?: string } = await res.json().catch(() => ({}))
            providerFileId = body.id ?? providerFileId
          }
        }
        if (!providerFileId) throw new Error('Google did not confirm the upload')

        const done = await postJson<CompleteData>('/api/upload-complete', {
          driveAccountId: target.current.driveAccountId,
          providerFileId,
          title: items.current.get(id)?.title,
        })
        sessionUrls.current.delete(id)
        patch(id, {
          status: 'success',
          progress: 100,
          fileId: done.file.id,
          link: `${window.location.origin}/s/${done.linkSlug}`,
          imageLink: done.imageLinkSlug ? `${window.location.origin}/i/${done.imageLinkSlug}.jpg` : undefined,
        })
      } catch (err) {
        if (isAbort(err)) patch(id, { status: 'paused' })
        else patch(id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
      } finally {
        abortControllers.current.delete(id)
      }
    },
    [patch],
  )

  const pump = useCallback(() => {
    while (activeUploads.current.size < MAX_CONCURRENT && queue.current.length > 0) {
      const id = queue.current.shift()
      if (!id || !items.current.has(id)) continue
      activeUploads.current.add(id)
      void runOne(id).finally(() => {
        activeUploads.current.delete(id)
        pump()
      })
    }
  }, [runOne])

  const addUploads = useCallback(
    (files: File[]) => {
      const added: UploadState[] = files.map((file) => {
        const id = crypto.randomUUID()
        const title = file.name.replace(/\.[^/.]+$/, '')
        items.current.set(id, { file, title })
        return { id, file, title, progress: 0, status: 'pending' }
      })
      setUploads((prev) => [...prev, ...added])
      queue.current.push(...added.map((u) => u.id))
      pump()
    },
    [pump],
  )

  const retryUpload = useCallback(
    (id: string) => {
      if (!items.current.has(id)) return
      patch(id, { status: 'pending', error: undefined })
      queue.current.push(id)
      pump()
    },
    [patch, pump],
  )

  const cancelUpload = useCallback((id: string) => {
    queue.current = queue.current.filter((qid) => qid !== id)
    abortControllers.current.get(id)?.abort()
    items.current.delete(id)
    sessionUrls.current.delete(id)
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const updateTitle = useCallback(
    (id: string, title: string) => {
      const item = items.current.get(id)
      if (item) item.title = title
      patch(id, { title })
    },
    [patch],
  )

  return { uploads, addUploads, retryUpload, cancelUpload, updateTitle }
}
