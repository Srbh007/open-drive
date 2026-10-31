"use client"
import * as React from "react"
import { UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

type Props = {
  slug: string
  /** Folder links upload new files into the folder; file links replace the file. */
  mode: "folder" | "file"
}

const CHUNK_SIZE = 8 * 1024 * 1024

async function readJson(res: Response): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { message?: string } }> {
  return res.json().catch(() => ({ ok: false }))
}

async function uploadOne(slug: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const sessionRes = await fetch(`/api/s/${slug}/upload-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size }),
  })
  const session = await readJson(sessionRes)
  const sessionUrl = session.data?.sessionUrl
  if (!session.ok || typeof sessionUrl !== "string") throw new Error(session.error?.message || "Upload could not start")

  let providerFileId: string | null = null
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
      body: file.slice(start, end),
    })
    if (res.status !== 308 && !res.ok) throw new Error("Upload failed")
    if (res.ok) {
      const body: { id?: string } = await res.json().catch(() => ({}))
      providerFileId = body.id ?? null
    }
    onProgress(Math.round((end / file.size) * 100))
  }
  if (!providerFileId) throw new Error("Upload did not finish")

  const done = await readJson(
    await fetch(`/api/s/${slug}/upload-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerFileId }),
    }),
  )
  if (!done.ok) throw new Error(done.error?.message || "Upload could not be saved")
}

export function LinkUploadBox({ slug, mode }: Props) {
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [label, setLabel] = React.useState("")

  const handleFiles = async (list: FileList | null) => {
    const picked = list ? Array.from(list) : []
    if (picked.length === 0) return
    setBusy(true)
    let failed = 0
    for (const file of picked) {
      setLabel(file.name)
      setProgress(0)
      try {
        await uploadOne(slug, file, setProgress)
      } catch (err) {
        failed++
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`)
      }
    }
    setBusy(false)
    if (failed === 0) {
      toast.success(mode === "file" ? "File replaced" : `${picked.length} file${picked.length > 1 ? "s" : ""} uploaded`)
      if (mode === "file") window.location.reload()
    }
  }

  if (busy) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-border p-3 text-left">
        <span className="truncate text-xs text-text-muted">Uploading {label}… {progress}%</span>
        <Progress value={progress} className="h-2" />
      </div>
    )
  }

  return (
    <label className="w-full">
      <Button variant="outline" className="w-full cursor-pointer" asChild>
        <span>
          <UploadCloud className="mr-2 h-4 w-4" /> {mode === "file" ? "Replace file" : "Upload files to this folder"}
        </span>
      </Button>
      <input type="file" className="hidden" multiple={mode === "folder"} onChange={(e) => void handleFiles(e.target.files)} />
    </label>
  )
}
