import * as React from "react";
import { UploadCloud } from "lucide-react";

interface DropOverlayProps {
  isDragging: boolean;
  folderName: string;
}

export function DropOverlay({ isDragging, folderName }: DropOverlayProps) {
  if (!isDragging) return null;

  return (
    <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] border-2 border-dashed border-primary m-2 rounded-xl flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-surface p-6 rounded-2xl shadow-xl flex flex-col items-center text-primary">
        <UploadCloud className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold">Drop to upload to {folderName}</h2>
      </div>
    </div>
  );
}
