"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { FileItem, DriveSummary, FolderPath, ViewMode, SortKey } from "@/lib/types";
import { Sidebar } from "@/components/explorer/Sidebar";
import { Breadcrumbs } from "@/components/explorer/Breadcrumbs";
import { FileTable } from "@/components/explorer/FileTable";
import { FileGrid } from "@/components/explorer/FileGrid";
import { Gallery } from "@/components/explorer/Gallery";
import { ContextMenu } from "@/components/explorer/ContextMenu";
import { PreviewPane } from "@/components/explorer/PreviewPane";
import { SelectionBar } from "@/components/explorer/SelectionBar";
import { EmptyState } from "@/components/explorer/EmptyState";
import { DropOverlay } from "@/components/explorer/DropOverlay";
import { ViewerModal } from "@/components/viewers/ViewerModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LayoutList, LayoutGrid, Image as ImageIcon, PanelRight, UploadCloud, ChevronUp, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// Ensure this page is only accessible in development
if (process.env.NODE_ENV === "production") {
  notFound();
}

// Mock Data Generation
const mockDrives: DriveSummary[] = [
  { id: "d1", email: "work@example.com", label: "Work Drive", color: "#3B82F6", status: "active", usedBytes: 500e9, totalBytes: 2000e9 },
  { id: "d2", email: "personal@example.com", label: "Personal Drive", color: "#10B981", status: "active", usedBytes: 15e9, totalBytes: 15e9 },
  { id: "d3", email: "archive@example.com", label: "Archive", color: "#8B5CF6", status: "active", usedBytes: 800e9, totalBytes: 2000e9 },
];

const generateFiles = (count: number, parentId: string | null): FileItem[] => {
  const mimeTypes = [
    "image/jpeg", "image/png", "video/mp4", "application/pdf",
    "application/vnd.google-apps.document", "application/vnd.google-apps.spreadsheet",
    "text/plain", "application/json"
  ];
  return Array.from({ length: count }).map((_, i) => ({
    id: `file_${parentId}_${i}`,
    driveAccountId: mockDrives[i % mockDrives.length].id,
    providerFileId: `prov_${i}`,
    parentProviderId: parentId,
    name: `File ${i}`,
    title: `File ${i} Title`,
    mimeType: i % 10 === 0 ? "application/vnd.google-apps.folder" : mimeTypes[i % mimeTypes.length],
    isFolder: i % 10 === 0,
    size: i % 10 === 0 ? 0 : Math.floor(Math.random() * 10000000),
    hasThumbnail: i % 2 === 0,
    webViewLink: "https://example.com",
    width: null,
    height: null,
    durationMs: null,
    modifiedAt: new Date(Date.now() - Math.random() * 10000000000),
    version: "1",
    trashed: false,
  }));
};

const allFiles = generateFiles(2000, "root");

export default function ExplorerDemo() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("details");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDesc, setSortDesc] = React.useState(false);
  const [selectedDriveId, setSelectedDriveId] = React.useState<string | undefined>("d1");
  const [currentFolder, setCurrentFolder] = React.useState<string>("root");
  const [path, setPath] = React.useState<FolderPath>([{ id: "root", name: "My Drive" }]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [previewPaneOpen, setPreviewPaneOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  // Derived state
  const currentFiles = React.useMemo(() => {
    const files = allFiles.filter(f => f.parentProviderId === currentFolder);
    files.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Folders always first
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDesc ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });
    return files;
  }, [currentFolder, sortKey, sortDesc]);

  const focusedFile = selectedIds.size === 1
    ? currentFiles.find(f => f.id === Array.from(selectedIds)[0]) || null
    : null;

  // Handlers
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  const handleSelect = (id: string, multi: boolean, range: boolean) => {
    if (multi) {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
    } else if (range) {
      // Basic range selection
      const idx = currentFiles.findIndex(f => f.id === id);
      const lastSelectedIdx = currentFiles.findIndex(f => selectedIds.has(f.id));
      if (lastSelectedIdx !== -1 && idx !== -1) {
        const start = Math.min(idx, lastSelectedIdx);
        const end = Math.max(idx, lastSelectedIdx);
        const newSet = new Set(selectedIds);
        for (let i = start; i <= end; i++) {
          newSet.add(currentFiles[i].id);
        }
        setSelectedIds(newSet);
      }
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  const handleOpen = (file: FileItem) => {
    if (file.isFolder) {
      setCurrentFolder(file.id);
      setPath([...path, { id: file.id, name: file.title || file.name }]);
      setSelectedIds(new Set());
    } else {
      const idx = currentFiles.findIndex(f => f.id === file.id);
      setViewerIndex(idx);
      setViewerOpen(true);
    }
  };

  const handleAction = (action: string, file?: FileItem) => {
    toast(`Action: ${action} on ${file ? (file.title || file.name) : 'selection'}`);
  };

  return (
    <div className="flex h-screen w-full bg-bg overflow-hidden text-text font-sans">
      <Sidebar
        drives={mockDrives}
        onSelectDrive={setSelectedDriveId}
        selectedDriveId={selectedDriveId}
      />

      <div
        className="flex-1 flex flex-col relative min-w-0"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); toast("Files dropped"); }}
      >
        {/* Top Bar */}
        <div className="h-12 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronUp className="h-4 w-4" /></Button>
            <Breadcrumbs path={path} onNavigate={(id) => {
              const idx = path.findIndex(p => p.id === id);
              if (idx !== -1) {
                setPath(path.slice(0, idx + 1));
                setCurrentFolder(id);
                setSelectedIds(new Set());
              }
            }} />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-muted" />
              <Input placeholder="Search (Ctrl+K)" className="h-8 w-64 pl-8 bg-surface-muted border-none" />
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

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          <ContextMenu onAction={handleAction}>
            <div
              className="flex-1 flex flex-col overflow-hidden bg-bg outline-none"
              tabIndex={0}
              onClick={() => setSelectedIds(new Set())}
            >
              {currentFiles.length === 0 ? (
                <EmptyState onUpload={() => toast("Upload dialog")} />
              ) : (
                viewMode === "details" ? (
                  <FileTable files={currentFiles} drives={mockDrives} sortKey={sortKey} sortDesc={sortDesc} onSort={handleSort} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                ) : viewMode === "icons" ? (
                  <FileGrid files={currentFiles} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                ) : (
                  <Gallery files={currentFiles} selectedIds={selectedIds} onSelect={handleSelect} onOpen={handleOpen} />
                )
              )}
            </div>
          </ContextMenu>

          {previewPaneOpen && (
            <PreviewPane file={focusedFile} drives={mockDrives} onClose={() => setPreviewPaneOpen(false)} onAction={handleAction} />
          )}

          <DropOverlay isDragging={isDragging} folderName={path[path.length - 1].name} />
          <SelectionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onCopyLinks={() => toast("Links copied")}
            onDownload={() => toast("Download started")}
            onDelete={() => toast("Items deleted")}
          />
        </div>
      </div>

      <ViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={currentFiles}
        currentIndex={viewerIndex}
        onChangeIndex={setViewerIndex}
        drives={mockDrives}
        onAction={handleAction}
      />
    </div>
  );
}
