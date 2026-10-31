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

const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB
const MAX_CONCURRENT = 3

export function useResumableUpload(driveAccountId: string, parentId: string) {
  const [uploads, setUploads] = useState<UploadState[]>([])
  const activeUploads = useRef(new Set<string>())
  const queue = useRef<string[]>([])
  const abortControllers = useRef(new Map<string, AbortController>())
  const sessionUrls = useRef(new Map<string, string>())

  const getSessionUrl = async (file: File, id: string) => {
    if (sessionUrls.current.has(id)) return sessionUrls.current.get(id)!
    
    const res = await fetch('/api/upload-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driveAccountId,
        parentId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      })
    })
    
    if (!res.ok) throw new Error('Failed to create upload session')
    
    const data = await res.json()
    sessionUrls.current.set(id, data.sessionUrl)
    return data.sessionUrl
  }

  const uploadChunk = async (url: string, chunk: ChunkInfo, totalSize: number, signal: AbortSignal) => {
    let retries = 0
    let delay = 1000

    while (retries < 5) {
      try {
        const headers: HeadersInit = {
          'Content-Range': `bytes ${chunk.start}-${chunk.end - 1}/${totalSize}`,
        }
        
        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body: chunk.blob,
          signal
        })
        
        if (res.ok || res.status === 308) {
          return res
        }
        
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
           throw new Error(`Upload failed with status ${res.status}`)
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') throw err
      }
      
      retries++
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
    
    throw new Error('Upload chunk failed after retries')
  }
  
  const getUploadedRange = async (url: string, totalSize: number, signal: AbortSignal): Promise<number> => {
    let retries = 0
    let delay = 1000

    while (retries < 3) {
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes */${totalSize}` },
          signal
        })
        
        if (res.status === 308) {
          const range = res.headers.get('Range')
          if (range) {
            const match = range.match(/bytes=0-(\d+)/)
            if (match) {
              return parseInt(match[1], 10) + 1
            }
          }
          return 0
        }
        
        if (res.ok) {
           return totalSize
        }
      } catch (err: unknown) {
         if ((err as Error).name === 'AbortError') throw err
      }
      retries++
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
    return 0
  }

  const processQueue = useCallback(async () => {
    while (activeUploads.current.size < MAX_CONCURRENT && queue.current.length > 0) {
      const id = queue.current.shift()!
      activeUploads.current.add(id)
      
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'uploading' } : u))
      
      const controller = new AbortController()
      abortControllers.current.set(id, controller)
      
      const upload = uploads.find(u => u.id === id)
      if (!upload) {
        activeUploads.current.delete(id)
        continue
      }
      
      try {
        const url = await getSessionUrl(upload.file, id)
        
        let startByte = await getUploadedRange(url, upload.file.size, controller.signal)
        
        let providerFileId = null
        
        while (startByte < upload.file.size) {
          const endByte = Math.min(startByte + CHUNK_SIZE, upload.file.size)
          const chunk = upload.file.slice(startByte, endByte)
          
          const res = await uploadChunk(url, { start: startByte, end: endByte, blob: chunk }, upload.file.size, controller.signal)
          
          startByte = endByte
          
          setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: (startByte / upload.file.size) * 100 } : u))
          
          if (res.ok) {
             const data = await res.json().catch(() => null)
             if (data && data.id) {
               providerFileId = data.id
             }
          }
        }
        
        if (!providerFileId) {
          // If we reached 100% in a previous run and resumed, we don't get the JSON body back directly in 308.
          // For a true fix, we might query the file metadata, but typically the last PUT returns 200 OK.
          throw new Error("Did not receive file id from Google")
        }

        const completeRes = await fetch('/api/upload-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             driveAccountId,
             providerFileId,
             parentProviderId: parentId, // Need actual folder provider ID for complete, simplified here. In a real app we'd map our DB parentId to Google's.
             name: upload.file.name,
             mimeType: upload.file.type,
             size: upload.file.size,
             title: upload.title
          })
        })
        
        if (!completeRes.ok) throw new Error("Failed to finalize upload")
        
        const completeData = await completeRes.json()

        setUploads(prev => prev.map(u => u.id === id ? { 
           ...u, 
           status: 'success', 
           progress: 100,
           link: `${window.location.origin}/s/${completeData.linkSlug}`,
           fileId: completeData.file.id,
           imageLink: completeData.imageLinkSlug ? `${window.location.origin}/i/${completeData.imageLinkSlug}` : undefined
        } : u))

      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
           setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: (err as Error).message } : u))
        } else {
           setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'paused' } : u))
        }
      } finally {
        activeUploads.current.delete(id)
        abortControllers.current.delete(id)
        processQueue()
      }
    }
  }, [driveAccountId, parentId, uploads])

  const addUploads = useCallback((files: File[]) => {
    const newUploads = files.map(file => {
      const id = Math.random().toString(36).substring(7)
      return {
        id,
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        progress: 0,
        status: 'pending' as const
      }
    })
    
    setUploads(prev => [...prev, ...newUploads])
    newUploads.forEach(u => queue.current.push(u.id))
    processQueue()
  }, [processQueue])

  const retryUpload = useCallback((id: string) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'pending', error: undefined } : u))
    queue.current.push(id)
    processQueue()
  }, [processQueue])

  const cancelUpload = useCallback((id: string) => {
    queue.current = queue.current.filter(qid => qid !== id)
    if (abortControllers.current.has(id)) {
      abortControllers.current.get(id)!.abort()
    }
    setUploads(prev => prev.filter(u => u.id !== id))
  }, [])
  
  const updateTitle = useCallback((id: string, title: string) => {
     setUploads(prev => prev.map(u => u.id === id ? { ...u, title } : u))
  }, [])

  return { uploads, addUploads, retryUpload, cancelUpload, updateTitle }
}
