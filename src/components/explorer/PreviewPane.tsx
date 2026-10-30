import * as React from "react";
import { FileItem, DriveSummary } from "@/lib/types";
import { formatBytes, formatDate, getFileLabel } from "@/lib/format";
import { canEditInGoogle } from "@/lib/viewers";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Download, Pencil, X } from "lucide-react";

interface PreviewPaneProps {
  file: FileItem | null;
  drives: DriveSummary[];
  onClose: () => void;
  onAction: (action: string, file: FileItem) => void;
}

export function PreviewPane({ file, drives, onClose, onAction }: PreviewPaneProps) {
  if (!file) return null;

  const drive = drives.find(d => d.id === file.driveAccountId);
  const isGoogleEdit = canEditInGoogle(file.mimeType);
  const isImage = file.mimeType.startsWith("image/");

  return (
    <div className="w-[320px] border-l border-border bg-surface flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-text truncate pr-4">{file.title || file.name}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 flex flex-col gap-6">
        <div className="w-full aspect-video bg-surface-muted rounded-lg flex items-center justify-center overflow-hidden border border-border">
          {file.hasThumbnail && (file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/")) ? (
            <img src={`/api/thumb/${file.id}?size=l`} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <div className="text-text-muted text-sm flex flex-col items-center gap-2">
              <span>{getFileLabel(file.mimeType, file.isFolder)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => onAction("open", file)}>
            <ExternalLink className="w-4 h-4 mr-2" /> Open
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => onAction("copy-link", file)}>
            <Copy className="w-4 h-4 mr-2" /> Copy link
          </Button>
          {isImage && (
            <Button variant="outline" className="w-full justify-start" onClick={() => onAction("copy-image-link", file)}>
              <Copy className="w-4 h-4 mr-2" /> Copy image link
            </Button>
          )}
          {!file.isFolder && (
            <Button variant="outline" className="w-full justify-start" onClick={() => onAction("download", file)}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          )}
          {isGoogleEdit && (
            <Button variant="outline" className="w-full justify-start" onClick={() => onAction("edit-google", file)}>
              <Pencil className="w-4 h-4 mr-2" /> Edit in Google
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <h4 className="font-semibold text-text border-b border-border pb-1">Details</h4>
          <div className="grid grid-cols-3 gap-1">
            <span className="text-text-muted">Type</span>
            <span className="col-span-2 text-text break-words">{getFileLabel(file.mimeType, file.isFolder)}</span>

            <span className="text-text-muted">Size</span>
            <span className="col-span-2 text-text">{file.isFolder ? "-" : formatBytes(file.size)}</span>

            <span className="text-text-muted">Modified</span>
            <span className="col-span-2 text-text">{formatDate(file.modifiedAt)}</span>

            <span className="text-text-muted">Drive</span>
            <span className="col-span-2 text-text flex items-center gap-1">
              {drive ? (
                <>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: drive.color }} />
                  {drive.label}
                </>
              ) : "Unknown"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
