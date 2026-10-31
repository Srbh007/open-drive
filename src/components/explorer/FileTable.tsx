import * as React from "react";
import { FileItem, SortKey, DriveSummary } from "@/lib/types";
import { formatBytes, formatDate, getFileLabel } from "@/lib/format";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Folder, File as FileIcon, Image as ImageIcon, FileText, Film, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTableProps {
  files: FileItem[];
  drives: DriveSummary[];
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean, range: boolean) => void;
  onOpen: (file: FileItem) => void;
}

export function FileTable({ files, drives, sortKey, sortDesc, onSort, selectedIds, onSelect, onOpen }: FileTableProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return <span className="ml-1">{sortDesc ? "↓" : "↑"}</span>;
  };

  const getIcon = (file: FileItem) => {
    if (file.isFolder) return <Folder className="w-4 h-4 text-blue-500" />;
    if (file.mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-pink-500" />;
    if (file.mimeType.startsWith("video/")) return <Film className="w-4 h-4 text-purple-500" />;
    if (file.mimeType.includes("spreadsheet")) return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
    if (file.mimeType.includes("document") || file.mimeType.includes("wordprocessing")) return <FileText className="w-4 h-4 text-blue-600" />;
    return <FileIcon className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex text-xs font-semibold text-text-muted border-b border-border h-9 items-center px-4 shrink-0 bg-surface-muted sticky top-0 z-10">
        <div className="flex-1 cursor-pointer flex items-center hover:text-text" onClick={() => onSort("name")}>
          Name <SortIndicator column="name" />
        </div>
        <div className="w-32 cursor-pointer flex items-center hover:text-text" onClick={() => onSort("modifiedAt")}>
          Date modified <SortIndicator column="modifiedAt" />
        </div>
        <div className="w-32 cursor-pointer flex items-center hover:text-text" onClick={() => onSort("mimeType")}>
          Type <SortIndicator column="mimeType" />
        </div>
        <div className="w-24 cursor-pointer flex items-center justify-end hover:text-text" onClick={() => onSort("size")}>
          Size <SortIndicator column="size" />
        </div>
        <div className="w-32 cursor-pointer flex items-center pl-4 hover:text-text" onClick={() => onSort("driveAccountId")}>
          Drive <SortIndicator column="driveAccountId" />
        </div>
      </div>

      {/* Body */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const file = files[virtualItem.index];
            const isSelected = selectedIds.has(file.id);
            const drive = drives.find(d => d.id === file.driveAccountId);

            return (
              <div
                key={virtualItem.key}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(file.id, e.ctrlKey || e.metaKey, e.shiftKey);
                }}
                onDoubleClick={() => onOpen(file)}
                className={cn(
                  "absolute top-0 left-0 w-full flex items-center px-4 text-sm text-text border-b border-border hover:bg-surface-muted cursor-default select-none",
                  isSelected && "bg-blue-50/50 dark:bg-blue-900/20"
                )}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="flex-1 flex items-center gap-2 overflow-hidden pr-4">
                  {getIcon(file)}
                  <span className="truncate">{file.title || file.name}</span>
                </div>
                <div className="w-32 truncate text-text-muted">
                  {formatDate(file.modifiedAt)}
                </div>
                <div className="w-32 truncate text-text-muted">
                  {getFileLabel(file.mimeType, file.isFolder)}
                </div>
                <div className="w-24 text-right text-text-muted">
                  {!file.isFolder && formatBytes(file.size)}
                </div>
                <div className="w-32 pl-4 flex items-center gap-2 overflow-hidden text-text-muted">
                  {drive && (
                    <>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: drive.color }} />
                      <span className="truncate">{drive.label}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
