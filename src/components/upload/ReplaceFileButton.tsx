"use client"
import * as React from "react"
import { UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"

export function ReplaceFileButton({ slug, fileName, fileType, fileSize }: { slug: string, fileName: string, fileType: string, fileSize: number }) {
  const [loading, setLoading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setProgress(0)
    try {
      const res = await fetch(`/api/s/${slug}/upload-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error?.message || "Failed to create session")
      
      const sessionUrl = data.data.sessionUrl
      
      const uploadRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes 0-${file.size - 1}/${file.size}`
        },
        body: file
      })

      if (!uploadRes.ok && uploadRes.status !== 308) throw new Error("Upload failed")
      
      setProgress(100)
      toast.success("File replaced successfully")
      window.location.reload()
    } catch (err: unknown) {
      toast.error((err as Error).message || "Upload error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-2 border border-border p-2 rounded-md">
         <span className="text-xs text-text-muted">Uploading... {progress}%</span>
         <Progress value={progress} className="h-2" />
      </div>
    )
  }

  return (
    <label>
      <Button variant="outline" className="w-full cursor-pointer" asChild>
        <span><UploadCloud className="mr-2 h-4 w-4" /> Replace File</span>
      </Button>
      <input type="file" className="hidden" onChange={handleFile} />
    </label>
  )
}
