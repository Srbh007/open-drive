import * as React from "react";
import { FileItem } from "@/lib/types";

interface PdfViewerProps {
  file: FileItem;
  src: string;
}

export function PdfViewer({ file, src }: PdfViewerProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-muted">
      <iframe
        src={`${src}#toolbar=1`}
        className="w-full h-full border-none"
        title={file.name}
      />
    </div>
  );
}
