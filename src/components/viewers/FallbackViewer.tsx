import * as React from "react";
import { FileItem } from "@/lib/types";
import { FileIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, getFileLabel } from "@/lib/format";

interface FallbackViewerProps {
  file: FileItem;
  onDownload: (file: FileItem) => void;
}

export function FallbackViewer({ file, onDownload }: FallbackViewerProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 rounded text-white p-8 text-center">
      <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6">
        <FileIcon className="w-12 h-12 text-white/70" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{file.title || file.name}</h2>
      <p className="text-white/60 mb-8">
        {getFileLabel(file.mimeType, file.isFolder)} • {formatBytes(file.size)}
      </p>
      <Button size="lg" onClick={() => onDownload(file)} className="bg-white text-black hover:bg-white/90">
        <Download className="w-5 h-5 mr-2" /> Download File
      </Button>
    </div>
  );
}
