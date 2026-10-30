import * as React from "react";
import { FileItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GalleryProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean, range: boolean) => void;
  onOpen: (file: FileItem) => void;
}

export function Gallery({ files, selectedIds, onSelect, onOpen }: GalleryProps) {
  // Gallery usually focuses on media files
  const mediaFiles = files.filter(f => f.mimeType.startsWith("image/") || f.mimeType.startsWith("video/"));

  // Find first selected file or first media file for the large preview
  const previewFile = mediaFiles.find(f => selectedIds.has(f.id)) || mediaFiles[0];

  return (
    <div className="flex flex-col h-full w-full bg-surface">
      {/* Large Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-muted border-b border-border overflow-hidden">
        {previewFile ? (
          previewFile.mimeType.startsWith("image/") ? (
            <img
              src={`/api/stream/${previewFile.id}`}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain shadow-md rounded"
            />
          ) : (
            <video
              src={`/api/stream/${previewFile.id}`}
              controls
              className="max-w-full max-h-full shadow-md rounded"
            />
          )
        ) : (
          <div className="text-text-muted">Select a media file to preview</div>
        )}
      </div>

      {/* Thumbnails Row */}
      <div className="h-32 flex items-center overflow-x-auto p-4 gap-4 bg-surface shrink-0">
        {mediaFiles.map(file => {
          const isSelected = selectedIds.has(file.id);

          return (
            <div
              key={file.id}
              onClick={(e) => {
                e.preventDefault();
                onSelect(file.id, e.ctrlKey || e.metaKey, e.shiftKey);
              }}
              onDoubleClick={() => onOpen(file)}
              className={cn(
                "h-[80px] min-w-[80px] max-w-[120px] rounded cursor-pointer overflow-hidden border-2 flex-shrink-0 transition-colors",
                isSelected ? "border-primary" : "border-transparent hover:border-border"
              )}
            >
              <img
                src={`/api/thumb/${file.id}?size=m`}
                alt={file.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4='; // fallback gray box
                }}
              />
            </div>
          );
        })}
        {mediaFiles.length === 0 && (
          <div className="text-sm text-text-muted w-full text-center">No media files in this folder</div>
        )}
      </div>
    </div>
  );
}
