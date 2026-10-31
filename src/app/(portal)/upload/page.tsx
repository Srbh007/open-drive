"use client"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { UploadCloud, Link2, Image as ImageIcon, Trash2, XCircle, CheckCircle2, RotateCcw, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useResumableUpload, UploadState } from "@/lib/use-resumable-upload"
import { toast } from "sonner"
import { DriveSummary } from "@/lib/types"

async function fetchDrives(): Promise<DriveSummary[]> {
  const res = await fetch('/api/drives')
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message)
  return json.data
}

export default function UploadPage() {
  const [selectedDriveId, setSelectedDriveId] = React.useState<string | undefined>()
  const [selectedFolderId] = React.useState<string>("root") // Default to root for simplicity
  const [isDragging, setIsDragging] = React.useState(false)
  
  const { data: drives = [] } = useQuery({
    queryKey: ['drives'],
    queryFn: fetchDrives,
  })

  React.useEffect(() => {
    if (drives.length > 0 && !selectedDriveId) {
      setSelectedDriveId(drives[0].id)
    }
  }, [drives, selectedDriveId])

  const { uploads, addUploads, updateTitle, retryUpload, cancelUpload } = useResumableUpload(selectedDriveId || "", selectedFolderId)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!selectedDriveId) {
      toast.error("Please select a drive first")
      return
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addUploads(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDriveId) {
      toast.error("Please select a drive first")
      return
    }
    if (e.target.files && e.target.files.length > 0) {
      addUploads(Array.from(e.target.files))
    }
  }

  const copyAllImageLinks = async () => {
    const links = uploads.map(u => u.imageLink).filter(Boolean) as string[]
    if (links.length === 0) {
      toast.error("No image links available")
      return
    }
    await navigator.clipboard.writeText(links.join('\n'))
    toast.success(`${links.length} image links copied to clipboard`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upload Files</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Destination:</span>
          <Select value={selectedDriveId} onValueChange={(val: string | null) => { if (val) setSelectedDriveId(val) }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a Drive" />
            </SelectTrigger>
            <SelectContent>
              {drives.map(drive => (
                <SelectItem key={drive.id} value={drive.id}>{drive.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-muted'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={handleDrop}
      >
        <UploadCloud className="mx-auto h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold mb-2">Drop files here to upload</h3>
        <p className="text-sm text-text-muted mb-4">Or click to select files from your computer</p>
        <label>
          <Button variant="outline" className="cursor-pointer" asChild>
            <span>Select Files</span>
          </Button>
          <input type="file" multiple className="hidden" onChange={handleFileSelect} />
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-muted">
            <h3 className="font-semibold">Uploads ({uploads.length})</h3>
            <Button variant="secondary" size="sm" onClick={copyAllImageLinks}>
              <Copy className="h-4 w-4 mr-2" /> Copy all image links
            </Button>
          </div>
          <div className="divide-y divide-border">
            {uploads.map((upload) => (
              <UploadRow 
                key={upload.id} 
                upload={upload} 
                onUpdateTitle={(title) => updateTitle(upload.id, title)}
                onRetry={() => retryUpload(upload.id)}
                onCancel={() => cancelUpload(upload.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadRow({ 
  upload, 
  onUpdateTitle, 
  onRetry, 
  onCancel 
}: { 
  upload: UploadState
  onUpdateTitle: (title: string) => void
  onRetry: () => void
  onCancel: () => void 
}) {
  const [localTitle, setLocalTitle] = React.useState(upload.title)

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${localTitle}?`)) return
    if (upload.status === 'success' && upload.fileId) {
      try {
        const res = await fetch(`/api/files/${upload.fileId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error("Delete failed")
        toast.success("File deleted")
      } catch (err) {
        toast.error("Failed to delete file from Drive")
      }
    }
    onCancel()
  }

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-surface-muted/50">
      <div className="w-12 h-12 flex-shrink-0 bg-surface-muted rounded-md flex items-center justify-center overflow-hidden">
        {upload.file.type.startsWith('image/') ? (
          <img src={URL.createObjectURL(upload.file)} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <UploadCloud className="h-6 w-6 text-text-muted" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Input 
          value={localTitle} 
          onChange={e => setLocalTitle(e.target.value)} 
          onBlur={async () => {
            onUpdateTitle(localTitle)
            if (upload.status === 'success' && upload.fileId) {
               try {
                 await fetch(`/api/files/${upload.fileId}`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ title: localTitle })
                 })
               } catch (e) {
                 toast.error("Failed to save title")
               }
            }
          }}
          className="h-8 text-sm font-medium border-transparent hover:border-border focus:border-primary bg-transparent"
        />
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>{(upload.file.size / 1024 / 1024).toFixed(2)} MB</span>
          {upload.status === 'uploading' && (
            <div className="flex-1 flex items-center gap-2">
              <Progress value={upload.progress} className="h-1.5" />
              <span>{Math.round(upload.progress)}%</span>
            </div>
          )}
          {upload.status === 'error' && <span className="text-danger flex items-center gap-1"><XCircle className="h-3 w-3"/> {upload.error}</span>}
          {upload.status === 'success' && <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Done</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {upload.status === 'error' && (
          <Button variant="ghost" size="icon" onClick={onRetry} title="Retry">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          disabled={!upload.link} 
          onClick={() => upload.link && copyToClipboard(upload.link, 'Link')}
          title="Copy Link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        
        {upload.file.type.startsWith('image/') && (
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={!upload.imageLink} 
            onClick={() => upload.imageLink && copyToClipboard(upload.imageLink, 'Image link')}
            title="Copy Image Link"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        )}
        
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-danger hover:text-danger hover:bg-danger/10" title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
