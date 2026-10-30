import * as React from "react";
import { FileItem } from "@/lib/types";
import { Folder, File as FileIcon, Image as ImageIcon, FileText, Film, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileGridProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean, range: boolean) => void;
  onOpen: (file: FileItem) => void;
}

export function FileGrid({ files, selectedIds, onSelect, onOpen }: FileGridProps) {
  const getIcon = (file: FileItem) => {
    if (file.hasThumbnail && file.mimeType.startsWith("image/")) {
      // Assuming a proxy route will serve the thumbnail for the ID
      return <img src={`/api/thumb/${file.id}?size=m`} alt={file.name} className="w-16 h-16 object-cover rounded" />;
    }
    const iconClass = "w-16 h-16 opacity-80";
    if (file.isFolder) return <Folder className={cn(iconClass, "text-blue-500 fill-blue-500")} />;
    if (file.mimeType.startsWith("image/")) return <ImageIcon className={cn(iconClass, "text-pink-500")} />;
    if (file.mimeType.startsWith("video/")) return <Film className={cn(iconClass, "text-purple-500")} />;
    if (file.mimeType.includes("spreadsheet")) return <FileSpreadsheet className={cn(iconClass, "text-green-500")} />;
    if (file.mimeType.includes("document") || file.mimeType.includes("wordprocessing")) return <FileText className={cn(iconClass, "text-blue-600")} />;
    return <FileIcon className={cn(iconClass, "text-gray-500")} />;
  };

  return (
    <div className="flex-1 overflow-auto p-4 flex flex-wrap gap-4 content-start">
      {files.map(file => {
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
              "w-[112px] h-[132px] flex flex-col items-center justify-start p-2 rounded-lg cursor-default select-none border border-transparent hover:bg-surface-muted",
              isSelected && "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            )}
          >
            <div className="w-[80px] h-[80px] flex items-center justify-center mb-2">
              {getIcon(file)}
            </div>
            <span className="text-sm text-text truncate w-full text-center" title={file.title || file.name}>
              {file.title || file.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
