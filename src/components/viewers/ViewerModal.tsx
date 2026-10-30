import * as React from "react";
import { FileItem, DriveSummary } from "@/lib/types";
import { getViewerKind, canEditInGoogle } from "@/lib/viewers";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Copy, Download, Pencil } from "lucide-react";
import { ImageViewer } from "./ImageViewer";
import { VideoPlayer } from "./VideoPlayer";
import { PdfViewer } from "./PdfViewer";
import { DocxViewer } from "./DocxViewer";
import { SheetViewer } from "./SheetViewer";
import { CodeViewer } from "./CodeViewer";
import { FallbackViewer } from "./FallbackViewer";

interface ViewerModalProps {
  files: FileItem[];
  currentIndex: number;
  drives: DriveSummary[];
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
  onAction: (action: string, file: FileItem) => void;
}

export function ViewerModal({ files, currentIndex, drives, isOpen, onClose, onChangeIndex, onAction }: ViewerModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || files.length === 0 || currentIndex < 0 || currentIndex >= files.length) return;
      if (e.key === "ArrowLeft") onChangeIndex(Math.max(0, currentIndex - 1));
      if (e.key === "ArrowRight") onChangeIndex(Math.min(files.length - 1, currentIndex + 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, files.length, onChangeIndex, onClose, isOpen]);

  if (!isOpen || files.length === 0 || currentIndex < 0 || currentIndex >= files.length) {
    return null;
  }

  const file = files[currentIndex];
  const kind = getViewerKind(file.mimeType);
  const drive = drives.find(d => d.id === file.driveAccountId);

  let ViewerContent = <FallbackViewer file={file} onDownload={(f) => onAction("download", f)} />;
  if (kind === "image") ViewerContent = <ImageViewer file={file} />;
  else if (kind === "video") ViewerContent = <VideoPlayer file={file} />;
  else if (kind === "pdf") ViewerContent = <PdfViewer file={file} />;
  else if (kind === "docx") ViewerContent = <DocxViewer file={file} />;
  else if (kind === "sheet") ViewerContent = <SheetViewer file={file} />;
  else if (kind === "code") ViewerContent = <CodeViewer file={file} />;

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen m-0 p-0 rounded-none bg-black/95 border-none flex flex-col hide-close-button">
        <DialogTitle className="sr-only">{file.title || file.name}</DialogTitle>
        {/* Top Toolbar */}
        <div className="h-14 flex items-center justify-between px-4 bg-black/50 text-white/90 backdrop-blur z-50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden pr-4">
            {drive && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: drive.color }} />}
            <span className="font-medium truncate">{file.title || file.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => onAction("copy-link", file)} title="Copy link">
              <Copy className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => onAction("download", file)} title="Download">
              <Download className="w-5 h-5" />
            </Button>
            {canEditInGoogle(file.mimeType) && (
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => onAction("edit-google", file)} title="Edit in Google">
                <Pencil className="w-5 h-5" />
              </Button>
            )}
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={onClose} title="Close (Esc)">
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-50 text-white/50 hover:text-white hover:bg-white/10 rounded-full w-12 h-12"
              onClick={(e) => { e.stopPropagation(); onChangeIndex(currentIndex - 1); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}

          <div className="w-full h-full flex items-center justify-center p-4">
             {ViewerContent}
          </div>

          {currentIndex < files.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-50 text-white/50 hover:text-white hover:bg-white/10 rounded-full w-12 h-12"
              onClick={(e) => { e.stopPropagation(); onChangeIndex(currentIndex + 1); }}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
