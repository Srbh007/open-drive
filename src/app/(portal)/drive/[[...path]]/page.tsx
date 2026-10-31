"use client"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Sidebar } from "@/components/explorer/Sidebar"
import { Breadcrumbs } from "@/components/explorer/Breadcrumbs"
import { FileTable } from "@/components/explorer/FileTable"
import { FileGrid } from "@/components/explorer/FileGrid"
import { Gallery } from "@/components/explorer/Gallery"
import { ContextMenu } from "@/components/explorer/ContextMenu"
import { PreviewPane } from "@/components/explorer/PreviewPane"
import { SelectionBar } from "@/components/explorer/SelectionBar"
import { EmptyState } from "@/components/explorer/EmptyState"
import { DropOverlay } from "@/components/explorer/DropOverlay"
import { ViewerModal } from "@/components/viewers/ViewerModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, LayoutList, LayoutGrid, Image as ImageIcon, PanelRight, UploadCloud, ChevronUp, ArrowLeft, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { useMultiSelect } from "@/components/explorer/use-multi-select"
import { FileItem, DriveSummary, FolderPath, ViewMode, SortKey } from "@/lib/types"

async function fetchDrives(): Promise<DriveSummary[]> {
  const res = await fetch('/api/drives')
  const json = await res.json()
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}

async function fetchFolders(driveId: string, parentId?: string, sortKey?: string, sortDesc?: boolean): Promise<FileItem[]> {
  const url = new URL('/api/folders', window.location.origin)
  url.searchParams.set('drive', driveId)
  if (parentId) url.searchParams.set('parent', parentId)
  if (sortKey) url.searchParams.set('sortKey', sortKey)
  url.searchParams.set('sortDesc', sortDesc ? 'true' : 'false')

  const res = await fetch(url.toString())
  const json = await res.json()
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}

async function fetchSearch(query: string, driveId?: string): Promise<FileItem[]> {
  const url = new URL('/api/search', window.location.origin)
  url.searchParams.set('q', query)
  if (driveId) url.searchParams.set('drive', driveId)

  const res = await fetch(url.toString())
  const json = await res.json()
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}

export default function DrivePage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("details")
  const [sortKey, setSortKey] = React.useState<SortKey>("name")
  const [sortDesc, setSortDesc] = React.useState(false)
  const [selectedDriveId, setSelectedDriveId] = React.useState<string | undefined>()
  const [currentFolder, setCurrentFolder] = React.useState<string>("root")
  const [path, setPath] = React.useState<FolderPath>([{ id: "root", name: "My Drive" }])
  const [previewPaneOpen, setPreviewPaneOpen] = React.useState(false)
  const [viewerOpen, setViewerOpen] = React.useState(false)
  const [viewerIndex, setViewerIndex] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const { data: drives = [] } = useQuery({
    queryKey: ['drives'],
    queryFn: fetchDrives,
  })

  React.useEffect(() => {
    if (drives.length > 0 && !selectedDriveId) {
      setSelectedDriveId(drives[0].id)
      setPath([{ id: "root", name: drives[0].label }])
    }
  }, [drives, selectedDriveId])

  const { data: files = [] } = useQuery({
    queryKey: ['files', selectedDriveId, currentFolder, sortKey, sortDesc, searchQuery],
    queryFn: () => {
      if (!selectedDriveId) return Promise.resolve([])
      if (searchQuery) return fetchSearch(searchQuery, selectedDriveId)
      return fetchFolders(selectedDriveId, currentFolder, sortKey, sortDesc)
    },
    enabled: !!selectedDriveId
  })

  const { selectedIds, setSelectedIds, handleSelect } = useMultiSelect(files)

  const focusedFile = selectedIds.size === 1
    ? files.find((f: FileItem) => f.id === Array.from(selectedIds)[0]) || null
    : null

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc)
    } else {
      setSortKey(key)
      setSortDesc(false)
    }
  }

  const handleOpen = (file: FileItem) => {
    if (file.isFolder) {
      setCurrentFolder(file.id)
      setPath([...path, { id: file.id, name: file.title || file.name }])
      setSelectedIds(new Set())
      setSearchQuery("")
    } else {
      const idx = files.findIndex((f: FileItem) => f.id === file.id)
      setViewerIndex(idx)
      setViewerOpen(true)
    }
  }

  const handleAction = (action: string, file?: FileItem) => {
    toast(`Action: ${action} on ${file ? (file.title || file.name) : 'selection'}`)
  }

  const getStreamUrl = (file: FileItem) => {
    return `/api/stream/${file.id}`
  }

  const handleDriveSelect = (id: string | undefined) => {
    setSelectedDriveId(id)
    setCurrentFolder("root")
    const drive = drives.find((d: DriveSummary) => d.id === id)
    setPath([{ id: "root", name: drive?.label || "My Drive" }])
    setSelectedIds(new Set())
    setSearchQuery("")
  }

  const currentPathName = path.length > 0 ? path[path.length - 1].name : "My Drive"

  return (
    <div className="flex h-full w-full bg-bg overflow-hidden text-text font-sans">
      <Sidebar
        drives={drives}
        onSelectDrive={handleDriveSelect}
        selectedDriveId={selectedDriveId}
      />

      <div
        className="flex-1 flex flex-col relative min-w-0"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); toast("Uploads coming soon"); }}
      >
        <div className="h-12 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronUp className="h-4 w-4" /></Button>
            <Breadcrumbs path={path} onNavigate={(id) => {
              const idx = path.findIndex(p => p.id === id)
              if (idx !== -1) {
                setPath(path.slice(0, idx + 1))
                setCurrentFolder(id)
                setSelectedIds(new Set())
              }
            }} />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search..."
                className="h-8 w-64 pl-8 bg-surface-muted border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex border border-border rounded-md overflow-hidden bg-surface-muted h-8">
              <button className={`px-2 ${viewMode === "details" ? "bg-surface shadow-sm" : ""}`} onClick={() => setViewMode("details")}><LayoutList className="h-4 w-4" /></button>
              <button className={`px-2 ${viewMode === "icons" ? "bg-surface shadow-sm" : ""}`} onClick={() => setViewMode("icons")}><LayoutGrid className="h-4 w-4" /></button>
              <button className={`px-2 ${viewMode === "gallery" ? "bg-surface shadow-sm" : ""}`} onClick={() => setViewMode("gallery")}><ImageIcon className="h-4 w-4" /></button>
            </div>

            <Button size="sm" className="h-8"><UploadCloud className="h-4 w-4 mr-2" /> Upload</Button>
            <Button variant={previewPaneOpen ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setPreviewPaneOpen(!previewPaneOpen)}>
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <ContextMenu onAction={handleAction}>
            <div
              className="flex-1 flex flex-col overflow-hidden bg-bg outline-none"
              tabIndex={0}
              onClick={() => setSelectedIds(new Set())}
            >
              {files.length === 0 ? (
                <EmptyState onUpload={() => toast("Uploads coming soon")} />
              ) : (
                viewMode === "details" ? (
                  <FileTable files={files} drives={drives} sortKey={sortKey} sortDesc={sortDesc} onSort={handleSort} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                ) : viewMode === "icons" ? (
                  <FileGrid files={files} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                ) : (
                  <Gallery files={files} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                )
              )}
            </div>
          </ContextMenu>

          {previewPaneOpen && (
            <PreviewPane file={focusedFile} drives={drives} onClose={() => setPreviewPaneOpen(false)} onAction={handleAction} />
          )}

          <DropOverlay isDragging={isDragging} folderName={currentPathName} />
          <SelectionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onCopyLinks={() => toast("Links coming soon")}
            onDownload={() => toast("Download coming soon")}
            onDelete={() => toast("Delete coming soon")}
          />
        </div>
      </div>

      <ViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={files}
        currentIndex={viewerIndex}
        onChangeIndex={setViewerIndex}
        drives={drives}
        onAction={handleAction}
        getStreamUrl={getStreamUrl}
      />
    </div>
  )
}
